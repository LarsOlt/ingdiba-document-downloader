import puppeteer from "puppeteer";
import { waitFor, waitForConsoleInput } from "./utilts";
import path from "path";
import { renameSync } from "fs";
import { utimes } from "utimes";
import moment from "moment";
import sanitizeFilename from "sanitize-filename";

async function start() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  const page = await browser.newPage();
  await page.goto("https://banking.ing.de/app/postbox/postbox");

  await waitForConsoleInput("Hit enter when logged in and the overview is loaded");

  const documentRows = await page.$$(".ibbr-table-body--bordered");

  const downloadFolder = path.resolve("./downloads");

  let client = await browser.target().createCDPSession();

  await client.send("Browser.setDownloadBehavior", {
    behavior: "allowAndName", //allow downloading file and save the file using guid as the filename
    downloadPath: downloadFolder, // specify the download folder
    eventsEnabled: true, //set true to emit download events (e.g. Browser.downloadWillBegin and Browser.
  });

  async function waitForDownload(data: {
    documentDate: string;
    documentType: string;
    documentName?: string;
  }) {
    return new Promise<void>((resolvePromise) => {
      const handler = async (event: any) => {
        if (event.state === "completed") {
          const { documentType, documentDate, documentName } = data;

          const oldPath = path.resolve(downloadFolder, event.guid);

          const newPath = path.resolve(
            downloadFolder,
            sanitizeFilename(
              `${documentType} - ${documentDate}${documentName ? ` - ${documentName}` : ""}.pdf`
            )
          );

          renameSync(oldPath, newPath);

          await utimes(newPath, {
            btime: moment(documentDate, "DD.MM.YYYY").valueOf(),
          });

          client.off("Browser.downloadProgress", handler);

          resolvePromise();
        }
      };

      client.on("Browser.downloadProgress", handler);
    });
  }

  async function downloadDocuments() {
    console.log("Starting downloading documents, this will take a while...");

    for (const row of documentRows) {
      waitFor(100);

      const expandButton = await row.$('button[data-trigger-state="closed"]');
      await expandButton?.click();

      const document = await row
        .evaluateHandle((e) => {
          const row = e.querySelector("span.gs-span-20")!;

          return [...row.childNodes]
            .map((e) => (e as HTMLSpanElement).innerText?.replaceAll("\n", " ").trim())
            .filter((x) => x?.length > 3);
        })
        .then((d) => d.jsonValue());

      const [documentDate, documentType, documentName] = document;

      const downloadButton = await row.$("a[tabindex='0']");

      await downloadButton?.click();

      await waitForDownload({
        documentDate,
        documentType,
        documentName,
      });
    }
  }

  await downloadDocuments();

  console.log(`Done, All documents downloaded to ${downloadFolder}`);

  await browser.close();
}

start();

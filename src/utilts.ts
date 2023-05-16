import readline from "readline";

export async function waitForConsoleInput(question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) =>
    rl.question(question + ": ", (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

export async function waitFor(ms: number) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

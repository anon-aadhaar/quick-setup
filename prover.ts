// This is a module worker, so we can use imports (in the browser too!)
import { genProof } from "./utils/chunkedUtil";

addEventListener("message", async (event: MessageEvent<number>) => {
  try {
    await genProof(event.data);
    postMessage("Proof generated");
  } catch (e) {
    postMessage(e);
  }
});

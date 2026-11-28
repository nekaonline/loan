export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startSchedulers } = await import("@/lib/schedulers");
    startSchedulers();
  } catch (error) {
    console.error("Scheduler startup failed:", error);
  }
}

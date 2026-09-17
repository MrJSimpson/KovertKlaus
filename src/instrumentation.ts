export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initLifecycleScheduler } = await import('@/lib/lifecycle-scheduler');
    initLifecycleScheduler();
  }
}

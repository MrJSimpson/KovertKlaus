export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initLifecycleScheduler } = await import('@/lib/lifecycle-scheduler');
    initLifecycleScheduler();

    // First-run setup: print the one-time admin setup token at boot when no admin exists.
    try {
      const { bootstrapInitialAdmin } = await import('@/lib/adminAuth');
      if ((await bootstrapInitialAdmin()) === 'setup-required') {
        const { announceSetupToken } = await import('@/lib/adminSetup');
        announceSetupToken();
      }
    } catch (error) {
      // Database may not be ready yet; the token is issued on the first setup or login request instead.
      console.warn('[NorthPole Setup] Deferred first-run check:', (error as Error)?.message || error);
    }
  }
}

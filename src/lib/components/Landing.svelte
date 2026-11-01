<script lang="ts">
  const features = [
    {
      icon: 'push_pin',
      title: 'Pin feedback on designs',
      body: 'Clients click straight on the design to leave a comment, and your team sees each pin next to the design.',
      img: '/landing/pins.jpg',
      alt: 'A design with two numbered pins on it and the feedback list beside it'
    },
    {
      icon: 'verified',
      title: 'Timestamped approvals',
      body: 'When a client approves a deliverable, the approval is saved with the date and time. You get a timestamped approval record to point back to.',
      img: '/landing/approved.jpg',
      alt: 'An approved deliverable with an approval record showing the date and time'
    },
    {
      icon: 'lock',
      title: 'Files locked until approved',
      body: 'Lock your final files to a deliverable. The client sees what unlocks them, and can download only after they approve it.',
      img: '/landing/locked.jpg',
      alt: 'A client files page with one file locked until the Home screen design is approved'
    },
    {
      icon: 'auto_awesome',
      title: 'AI feedback summaries',
      body: 'One click turns a pile of pins into a short summary of what still needs changing. Bring your own key for an OpenAI-compatible provider.',
      img: '/landing/ai-summary.jpg',
      alt: 'An AI summary of two feedback pins above the pin list'
    },
    {
      icon: 'palette',
      title: 'White-label: your logo, name and colors',
      body: 'Clients see your agency name and logo instead of ours. You host it yourself, so it can sit on your own domain.',
      img: '/landing/portal.jpg',
      alt: 'A client project page headed with the agency name, showing timeline, approvals and milestones'
    }
  ];

  let name = $state('');
  let email = $state('');
  let agencyName = $state('');
  let website = $state(''); // honeypot: real visitors never see or fill this
  let status = $state<'idle' | 'sending' | 'done' | 'error'>('idle');
  let message = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (status === 'sending') return;
    status = 'sending';
    message = '';
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, agencyName, website })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
      status = 'done';
    } catch (err: any) {
      status = 'error';
      message = err.message || 'Something went wrong. Please try again.';
    }
  }
</script>

<div class="landing-dark min-h-screen bg-background text-on-background font-sans antialiased">
  <header class="sticky top-0 z-40 border-b border-outline-variant bg-surface/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4">
      <a href="/" class="text-[15px] font-semibold tracking-tight text-on-surface">ClientDesk</a>
      <nav class="flex items-center gap-2">
        <a href="/login" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface">Sign in</a>
        <a href="#demo" class="rounded-md bg-primary-hover px-3 py-1.5 text-[13px] font-medium text-on-primary hover:opacity-90">Request a live demo</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="mx-auto max-w-[1100px] px-4 pb-10 pt-12 text-center md:pb-16 md:pt-20">
      <h1 class="mx-auto max-w-3xl text-[32px] font-semibold leading-[1.1] tracking-tight text-on-surface md:text-[52px]">
        A client portal you own, with no monthly fees
      </h1>
      <p class="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-on-surface-variant md:text-[18px]">
        One branded place for your clients to review designs, approve work and download final files, with the full source code in your hands.
      </p>
      <div class="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="#demo" class="w-full rounded-lg bg-primary-hover px-6 py-3 text-[15px] font-medium text-on-primary hover:opacity-90 sm:w-auto">Request a live demo</a>
        <a href="#features" class="w-full rounded-lg border border-outline-variant px-6 py-3 text-[15px] font-medium text-on-surface hover:bg-surface-container sm:w-auto">See what it does</a>
      </div>
      <img
        src="/landing/pins.jpg"
        width="1280"
        height="800"
        alt="Client feedback pinned directly on a design, with the feedback list beside it"
        fetchpriority="high"
        class="mx-auto mt-10 h-auto w-full max-w-[960px] rounded-xl border border-outline-variant shadow-2xl"
      />
    </section>

    <section id="features" class="mx-auto max-w-[1100px] scroll-mt-16 px-4 py-10 md:py-16" aria-labelledby="features-h">
      <h2 id="features-h" class="text-center text-[24px] font-semibold tracking-tight text-on-surface md:text-[32px]">Everything between "here's the design" and "it's approved"</h2>
      <ul class="mt-10 space-y-14 md:mt-14 md:space-y-20">
        {#each features as f, i}
          <li class="grid items-center gap-6 md:grid-cols-2 md:gap-12">
            <div class={i % 2 === 1 ? 'md:order-2' : ''}>
              <span class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{f.icon}</span>
              </span>
              <h3 class="text-[20px] font-semibold text-on-surface md:text-[24px]">{f.title}</h3>
              <p class="mt-2 text-[15px] leading-relaxed text-on-surface-variant md:text-[16px]">{f.body}</p>
            </div>
            <img
              src={f.img}
              width="1280"
              height="800"
              alt={f.alt}
              loading="lazy"
              decoding="async"
              class="h-auto w-full rounded-xl border border-outline-variant shadow-xl {i % 2 === 1 ? 'md:order-1' : ''}"
            />
          </li>
        {/each}
      </ul>

      <div class="mt-14 flex flex-wrap justify-center gap-2 md:mt-20" aria-label="Also included">
        {#each ['Stripe invoicing, bring your own keys', 'Client messaging', 'Project task board'] as chip}
          <span class="rounded-full border border-outline-variant bg-surface px-4 py-1.5 text-[13px] text-on-surface-variant">{chip}</span>
        {/each}
      </div>
    </section>

    <section class="mx-auto max-w-[1100px] px-4 py-10 md:py-16" aria-labelledby="licence-h">
      <div class="mx-auto max-w-xl rounded-2xl border border-primary/40 bg-surface p-6 text-center md:p-8">
        <h2 id="licence-h" class="text-[13px] font-semibold uppercase tracking-wider text-on-primary-container">Licence</h2>
        <p class="mt-3 text-[40px] font-semibold leading-none text-on-surface md:text-[48px]">$3,500</p>
        <p class="mt-1 text-[15px] text-on-surface-variant">one-time</p>
        <ul class="mx-auto mt-5 max-w-xs space-y-2 text-left text-[15px] text-on-surface">
          <li class="flex gap-2"><span class="material-symbols-outlined text-[20px] text-success" aria-hidden="true">check_circle</span>Full source code</li>
          <li class="flex gap-2"><span class="material-symbols-outlined text-[20px] text-success" aria-hidden="true">check_circle</span>One company licence</li>
        </ul>
        <p class="mt-5 text-[12px] leading-relaxed text-on-surface-variant">
          No subscription from us. You pay for your own hosting and for any services you connect, such as Supabase, Vercel, email, Stripe or an AI provider.
        </p>
      </div>
    </section>

    <section id="demo" class="mx-auto max-w-[1100px] scroll-mt-16 px-4 pb-16 pt-6 md:pb-24" aria-labelledby="demo-h">
      <div class="mx-auto max-w-md">
        <h2 id="demo-h" class="text-center text-[24px] font-semibold tracking-tight text-on-surface md:text-[32px]">Request a live demo</h2>
        <p class="mt-2 text-center text-[15px] text-on-surface-variant">Leave your details and we'll reply by email.</p>

        {#if status === 'done'}
          <div class="mt-6 rounded-xl border border-success/40 bg-success-container p-5 text-center text-[15px] text-on-surface" role="status">
            Thanks, we've got your request and will be in touch.
          </div>
        {:else}
          <form class="mt-6 space-y-4" onsubmit={submit}>
            <div>
              <label for="dr-name" class="mb-1 block text-[13px] font-medium text-on-surface">Name</label>
              <input id="dr-name" name="name" type="text" required maxlength="100" autocomplete="name" bind:value={name}
                class="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none focus:border-primary" />
            </div>
            <div>
              <label for="dr-email" class="mb-1 block text-[13px] font-medium text-on-surface">Email</label>
              <input id="dr-email" name="email" type="email" required maxlength="200" autocomplete="email" bind:value={email}
                class="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none focus:border-primary" />
            </div>
            <div>
              <label for="dr-agency" class="mb-1 block text-[13px] font-medium text-on-surface">Agency name</label>
              <input id="dr-agency" name="agency" type="text" required maxlength="150" autocomplete="organization" bind:value={agencyName}
                class="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none focus:border-primary" />
            </div>
            <div class="hp" aria-hidden="true">
              <label for="dr-website">Website</label>
              <input id="dr-website" name="website" type="text" tabindex="-1" autocomplete="off" bind:value={website} />
            </div>
            {#if status === 'error'}
              <p class="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container" role="alert">{message}</p>
            {/if}
            <button type="submit" disabled={status === 'sending'}
              class="w-full rounded-lg bg-primary-hover px-6 py-3 text-[15px] font-medium text-on-primary hover:opacity-90 disabled:opacity-60">
              {status === 'sending' ? 'Sending…' : 'Request a live demo'}
            </button>
          </form>
        {/if}
      </div>
    </section>
  </main>

  <footer class="border-t border-outline-variant">
    <div class="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-6 text-[13px] text-on-surface-variant">
      <span>© {new Date().getFullYear()} ClientDesk</span>
      <a href="/login" class="hover:text-on-surface">Sign in</a>
    </div>
  </footer>
</div>

<style>
  .landing-dark {
    color-scheme: dark;
    --c-primary: 139 92 246;
    --c-primary-hover: 124 58 237;
    --c-primary-container: 46 30 92;
    --c-on-primary: 255 255 255;
    --c-on-primary-container: 221 214 254;
    --c-success: 52 211 153;
    --c-success-container: 16 56 44;
    --c-error-container: 69 26 26;
    --c-on-error-container: 254 202 202;
    --c-surface: 21 27 40;
    --c-surface-container: 30 38 54;
    --c-on-surface: 236 239 244;
    --c-on-surface-variant: 148 158 176;
    --c-on-background: 236 239 244;
    --c-background: 11 15 26;
    --c-outline-variant: 45 55 74;
  }
  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  a:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid rgb(var(--c-primary));
    outline-offset: 2px;
  }
</style>

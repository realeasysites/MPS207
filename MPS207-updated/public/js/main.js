// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // Quote form submission (contact page)
  const form = document.getElementById('quote-form');
  const statusEl = document.getElementById('form-status');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = 'Sending...';
      statusEl.className = '';

      const formData = new FormData(form);
      const services = formData.getAll('services');
      const payload = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        services,
        preferred_date: formData.get('preferred_date'),
        message: formData.get('message'),
      };

      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          statusEl.textContent = "Thanks — that's in. Keith (or the team) will get back to you shortly. For anything urgent, call/text (207) 504-7586.";
          statusEl.className = 'success';
          form.reset();
        } else {
          statusEl.textContent = data.error || 'Something went wrong. Please call/text (207) 504-7586 directly.';
          statusEl.className = 'error';
        }
      } catch (err) {
        statusEl.textContent = 'Something went wrong. Please call/text (207) 504-7586 directly.';
        statusEl.className = 'error';
      }
    });
  }
});

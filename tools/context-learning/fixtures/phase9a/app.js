const menu = document.querySelector('.menu-button');
const nav = document.querySelector('#primary-nav');
menu?.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); });
document.querySelector('#contact-form')?.addEventListener('submit', (event) => { event.preventDefault(); const email = document.querySelector('#email'); const message = document.querySelector('#form-message'); if (!email.value || !email.validity.valid) { message.textContent = 'Please enter a valid email.'; email.setAttribute('aria-invalid', 'true'); email.focus(); return; } email.removeAttribute('aria-invalid'); message.textContent = 'Thanks — we’ll be in touch soon.'; });

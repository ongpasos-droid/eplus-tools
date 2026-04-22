<?php
/**
 * Reusable newsletter CTA box with real subscription form.
 * Posts to /v1/subscribers on the tool backend.
 *
 * Usage: efs_cta( 'newsletter' );
 *
 * Tool endpoint is resolved client-side by hostname:
 *   eufundingschool.test   → http://localhost:3000
 *   eufundingschool.com    → https://app.eufundingschool.com
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$source = is_single() ? 'blog_post' : ( is_home() ? 'blog_home' : 'wp' );
$source = preg_replace( '/[^a-z0-9_-]/i', '', $source ) ?: 'wp';
?>
<aside class="efs-cta efs-cta--newsletter" data-efs-newsletter data-source="<?php echo esc_attr( $source ); ?>">
	<h3>Recibe cada mes las calls Erasmus+ por prioridad</h3>
	<p>Un correo el primer viernes de cada mes. Calls abiertas, un tip práctico y el artículo destacado. Sin relleno.</p>

	<form class="efs-newsletter-form" novalidate>
		<label class="sr-only" for="efs-news-email-<?php echo esc_attr( $source ); ?>">Tu email</label>
		<input
			type="email"
			name="email"
			id="efs-news-email-<?php echo esc_attr( $source ); ?>"
			class="efs-newsletter-form__input"
			placeholder="tu@email.com"
			autocomplete="email"
			required>
		<button type="submit" class="efs-cta__btn efs-newsletter-form__btn">
			Apuntarme →
		</button>
	</form>
	<p class="efs-newsletter-form__msg" role="status" aria-live="polite"></p>
	<p class="efs-newsletter-form__legal">
		Al apuntarte aceptas la <a href="<?php echo esc_url( home_url( '/politica-de-privacidad/' ) ); ?>">política de privacidad</a>. Puedes darte de baja cuando quieras desde cualquier email.
	</p>
</aside>

<style>
	.efs-newsletter-form { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.5rem; }
	.efs-newsletter-form__input {
		flex:1 1 220px; min-width:220px;
		padding:.7rem 1rem;
		border:1px solid rgba(255,255,255,0.22);
		background: rgba(255,255,255,0.08);
		color:#fff;
		border-radius: var(--efs-radius, .25rem);
		font: 500 .95rem/1.3 var(--efs-font-body, inherit);
	}
	.efs-newsletter-form__input::placeholder { color: rgba(255,255,255,0.55); }
	.efs-newsletter-form__input:focus {
		outline:none; border-color: var(--efs-color-accent, #e7eb00);
		box-shadow: 0 0 0 2px rgba(231,235,0,0.35);
	}
	.efs-cta--light .efs-newsletter-form__input {
		background:#fff; color: var(--efs-color-text);
		border-color: var(--efs-color-line);
	}
	.efs-newsletter-form__btn { flex: 0 0 auto; }
	.efs-newsletter-form__msg { margin-top: .6rem; font-size: .9rem; min-height: 1.2em; }
	.efs-newsletter-form__msg.is-ok  { color: var(--efs-color-accent, #e7eb00); }
	.efs-newsletter-form__msg.is-err { color: #ffb4b4; }
	.efs-cta--light .efs-newsletter-form__msg.is-ok { color: #2E7D32; }
	.efs-cta--light .efs-newsletter-form__msg.is-err { color: var(--efs-color-error, #ba1a1a); }
	.efs-newsletter-form__legal {
		margin: .75rem 0 0 0;
		font-size: .72rem;
		color: rgba(255,255,255,0.55);
	}
	.efs-cta--light .efs-newsletter-form__legal { color: var(--efs-color-muted); }
	.efs-newsletter-form__legal a { color: inherit; text-decoration: underline; }
	.sr-only {
		position:absolute; width:1px; height:1px; padding:0; margin:-1px;
		overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
	}
</style>

<script>
(function () {
	if (window.__efsNewsletterBound) return;
	window.__efsNewsletterBound = true;

	function toolOrigin() {
		var h = window.location.hostname;
		if (h === 'eufundingschool.test' || h === 'localhost' || h === '127.0.0.1') {
			return 'http://localhost:3000';
		}
		return 'https://app.eufundingschool.com';
	}

	document.addEventListener('submit', function (e) {
		var form = e.target.closest('.efs-newsletter-form');
		if (!form) return;
		e.preventDefault();

		var wrap = form.closest('[data-efs-newsletter]');
		var source = wrap ? wrap.getAttribute('data-source') || 'blog' : 'blog';
		var email  = form.querySelector('input[type=email]').value.trim();
		var msg    = wrap ? wrap.querySelector('.efs-newsletter-form__msg') : null;
		var btn    = form.querySelector('button[type=submit]');

		if (msg) { msg.textContent = ''; msg.classList.remove('is-ok','is-err'); }
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			if (msg) { msg.textContent = 'Introduce un email válido.'; msg.classList.add('is-err'); }
			return;
		}
		if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Enviando…'; }

		fetch(toolOrigin() + '/v1/subscribers', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify({ email: email, source: source })
		})
		.then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
		.then(function (x) {
			if (!x.r.ok || !x.j.ok) {
				var err = (x.j && x.j.error && x.j.error.message) || 'No se pudo completar la suscripción.';
				throw new Error(err);
			}
			if (msg) { msg.textContent = '¡Listo! Revisa tu bandeja de entrada.'; msg.classList.add('is-ok'); }
			form.reset();
		})
		.catch(function (err) {
			if (msg) { msg.textContent = err.message || 'Error de conexión.'; msg.classList.add('is-err'); }
		})
		.finally(function () {
			if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || 'Apuntarme →'; }
		});
	});
})();
</script>

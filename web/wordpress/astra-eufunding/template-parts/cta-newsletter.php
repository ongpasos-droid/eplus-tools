<?php
/**
 * Reusable newsletter CTA box.
 * Usage: efs_cta( 'newsletter' );
 */
if ( ! defined( 'ABSPATH' ) ) exit;
?>
<aside class="efs-cta efs-cta--newsletter">
	<h3>Recibe cada mes las calls Erasmus+ por prioridad</h3>
	<p>Un correo el primer viernes de cada mes. Calls abiertas, un tip práctico y el artículo destacado. Sin relleno.</p>
	<a class="efs-cta__btn" href="<?php echo esc_url( home_url( '/newsletter/' ) ); ?>">Apuntarme al boletín →</a>
</aside>

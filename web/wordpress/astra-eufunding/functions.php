<?php
/**
 * EU Funding School — Astra Child
 *
 * Notas de diseño:
 * - El tema hereda de Astra. Solo añade/sobrescribe lo que marca diferencia.
 * - Plantillas custom: home.php (blog index), single.php, archive.php.
 * - CSS custom vive en style.css, cargado después del padre.
 * - Template partials reutilizables en /template-parts/ (cta-newsletter, cta-sandbox).
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'EFS_CHILD_VERSION', '0.2.0' );

/* -------------------------------------------------------------------------
 * Enqueue parent + child styles + Manrope
 * Manrope es la fuente compartida del ecosistema (WP + tool E+).
 * Tokens completos en web/brand/tokens.css del monorepo.
 * ------------------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'efs-manrope',
		'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap',
		array(),
		null
	);

	$parent_handle = 'astra-theme-css';
	wp_enqueue_style(
		'astra-eufunding',
		get_stylesheet_directory_uri() . '/style.css',
		array( $parent_handle, 'efs-manrope' ),
		EFS_CHILD_VERSION
	);
}, 20 );

/* -------------------------------------------------------------------------
 * Landing page template support — a page assigned to the
 * "Landing (sin menú)" template gets body class efs-landing-page
 * ------------------------------------------------------------------------- */
add_filter( 'theme_page_templates', function ( $templates ) {
	$templates['page-landing.php'] = 'Landing (sin menú)';
	return $templates;
} );

add_filter( 'template_include', function ( $template ) {
	if ( is_page() ) {
		$page_template = get_post_meta( get_the_ID(), '_wp_page_template', true );
		if ( 'page-landing.php' === $page_template ) {
			$candidate = locate_template( 'page-landing.php' );
			if ( $candidate ) return $candidate;
		}
	}
	return $template;
} );

add_filter( 'body_class', function ( $classes ) {
	if ( is_page() ) {
		$tpl = get_post_meta( get_the_ID(), '_wp_page_template', true );
		if ( 'page-landing.php' === $tpl ) $classes[] = 'efs-landing-page';
	}
	return $classes;
} );

/* -------------------------------------------------------------------------
 * Helper: render CTA partial
 * ------------------------------------------------------------------------- */
function efs_cta( $slug ) {
	get_template_part( 'template-parts/cta', $slug );
}

/* -------------------------------------------------------------------------
 * Tweaks to Astra defaults that the blog needs
 * ------------------------------------------------------------------------- */

// Show 9 posts per page on blog index (instead of default 10 but more grid-friendly)
add_action( 'pre_get_posts', function ( $q ) {
	if ( ! is_admin() && $q->is_main_query() && ( $q->is_home() || $q->is_archive() ) ) {
		$q->set( 'posts_per_page', 9 );
	}
} );

// Excerpt length and more string tuned for blog cards
add_filter( 'excerpt_length', function () { return 28; }, 999 );
add_filter( 'excerpt_more',   function () { return '…'; }, 999 );

// Disable wp_page_menu() fallback globally — we always want the assigned nav_menu,
// never an auto-generated list of every published page.
add_filter( 'wp_page_menu', '__return_empty_string', 999 );

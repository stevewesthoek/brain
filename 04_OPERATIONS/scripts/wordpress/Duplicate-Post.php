WP Duplicate post plugin

<?php
/**
 * Plugin Name: Duplicate Post
 * Description: Add functionality to duplicate posts with error handling and security improvements.
 * Version: 1.1
 * Author: Your Name
 * Author URI: http://yourwebsite.com/
 */

// Action to add a duplicate post link to action list for post_row_actions
function duplicate_post_link($actions, $post) {
	    if (current_user_can('edit_posts')) {
		        $actions['duplicate'] = '<a href="' . wp_nonce_url('admin.php?action=duplicate_post_as_draft&post=' . $post->ID, 'duplicate_post_' . $post->ID) . '" title="Duplicate this item" rel="permalink">Duplicate</a>';
	    }
	    return $actions;
}
add_filter('post_row_actions', 'duplicate_post_link', 10, 2);

// Function to create the duplicate as a draft
function duplicate_post_as_draft() {
	    global $wpdb;
	
	    // Check for the duplicate post action and nonce verification
	    if ((isset($_GET['action']) && $_GET['action'] === 'duplicate_post_as_draft') && (isset($_GET['post']) || isset($_POST['post']))) {
		        check_admin_referer('duplicate_post_' . $_GET['post']);
		
		        $post_id = (isset($_GET['post']) ? absint($_GET['post']) : absint($_POST['post']));
		        $post = get_post($post_id);
		
		        // Make sure the post exists
		        if (!$post) {
			            wp_die('Post creation failed, could not find original post.');
		        }
		
		        // Duplicate post data array
		        $args = array(
			            'comment_status' => $post->comment_status,
			            'ping_status'    => $post->ping_status,
			            'post_author'    => $post->post_author,
			            'post_content'   => $post->post_content,
			            'post_excerpt'   => $post->post_excerpt,
			            'post_name'      => $post->post_name,
			            'post_parent'    => $post->post_parent,
			            'post_password'  => $post->post_password,
			            'post_status'    => 'draft',
			            'post_title'     => $post->post_title . ' (Copy)',
			            'post_type'      => $post->post_type,
			            'to_ping'        => $post->to_ping,
			            'menu_order'     => $post->menu_order
		        );
		
		        // Insert the post and get the new post ID
		        $new_post_id = wp_insert_post($args, true);
		
		        // Handle error in post creation
		        if (is_wp_error($new_post_id)) {
			            wp_die('Post duplication failed: ' . $new_post_id->get_error_message());
		        }
		
		        // Duplicate all taxonomies/terms
		        $taxonomies = get_object_taxonomies($post->post_type);
		        foreach ($taxonomies as $taxonomy) {
			            $post_terms = wp_get_object_terms($post_id, $taxonomy);
			            $post_terms_slugs = array();
			            foreach ($post_terms as $term) {
				                $post_terms_slugs[] = $term->slug;
			            }
			            wp_set_object_terms($new_post_id, $post_terms_slugs, $taxonomy);
		        }
		
		        // Duplicate all custom fields/meta data
		        $post_meta_infos = $wpdb->get_results($wpdb->prepare("SELECT meta_key, meta_value FROM $wpdb->postmeta WHERE post_id=%d", $post_id));
		        foreach ($post_meta_infos as $meta_info) {
			            update_post_meta($new_post_id, $meta_info->meta_key, $meta_info->meta_value);
		        }
		
		        // Redirect to the edit post screen for the new draft
		        wp_redirect(admin_url('post.php?action=edit&post=' . $new_post_id));
		        exit;
	    }
}
add_action('admin_init', 'duplicate_post_as_draft');
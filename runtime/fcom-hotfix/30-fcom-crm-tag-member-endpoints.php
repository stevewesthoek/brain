<?php
/**
 * Plugin Name: JPV FluentCommunity CRM Tag Member Endpoints
 * Description: Adds the missing FluentCommunity REST endpoints used by the admin "CRM Tag" member importer.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('fluent-community/v2', '/spaces/(?P<spaceSlug>[a-zA-Z0-9-_]+)/members/resolve-crm-tag', [
        'methods'             => 'POST',
        'callback'            => 'jpv_fcom_resolve_crm_tag_members',
        'permission_callback' => 'jpv_fcom_can_manage_space_members',
        'args'                => [
            'spaceSlug' => [
                'required'          => true,
                'sanitize_callback' => 'sanitize_title',
            ],
        ],
    ]);

    register_rest_route('fluent-community/v2', '/spaces/(?P<spaceSlug>[a-zA-Z0-9-_]+)/members/bulk-add', [
        'methods'             => 'POST',
        'callback'            => 'jpv_fcom_bulk_add_space_members',
        'permission_callback' => 'jpv_fcom_can_manage_space_members',
        'args'                => [
            'spaceSlug' => [
                'required'          => true,
                'sanitize_callback' => 'sanitize_title',
            ],
        ],
    ]);
});

function jpv_fcom_can_manage_space_members(WP_REST_Request $request)
{
    if (!is_user_logged_in() || !current_user_can('manage_options')) {
        return false;
    }

    return jpv_fcom_get_space_by_slug($request['spaceSlug']) ? true : new WP_Error(
        'jpv_fcom_space_not_found',
        __('Space not found', 'fluent-community'),
        ['status' => 404]
    );
}

function jpv_fcom_resolve_crm_tag_members(WP_REST_Request $request)
{
    global $wpdb;

    $tagId = absint($request->get_param('tag_id'));
    if (!$tagId) {
        return new WP_Error('jpv_fcom_missing_tag_id', 'tag_id is required', ['status' => 400]);
    }

    $offset = max(0, absint($request->get_param('offset')));
    $perPage = absint($request->get_param('per_page'));
    $perPage = min(500, max(1, $perPage ?: 200));
    $createMissing = filter_var($request->get_param('create_missing'), FILTER_VALIDATE_BOOLEAN);

    $subscribersTable = $wpdb->prefix . 'fc_subscribers';
    $pivotTable = $wpdb->prefix . 'fc_subscriber_pivot';

    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT s.id, s.email, s.first_name, s.last_name, s.user_id
         FROM {$subscribersTable} s
         INNER JOIN {$pivotTable} p ON p.subscriber_id = s.id
         WHERE p.object_type = %s
           AND p.object_id = %d
           AND s.status = %s
         ORDER BY s.id ASC
         LIMIT %d OFFSET %d",
        'FluentCrm\\App\\Models\\Tag',
        $tagId,
        'subscribed',
        $perPage + 1,
        $offset
    ));

    $hasMore = count($rows) > $perPage;
    $rows = array_slice($rows, 0, $perPage);

    $userIds = [];
    $failed = 0;

    foreach ($rows as $row) {
        $userId = absint($row->user_id);

        if (!$userId && is_email($row->email)) {
            $userId = (int) email_exists($row->email);
        }

        if (!$userId && $createMissing && is_email($row->email)) {
            $userId = jpv_fcom_create_wp_user_from_crm_row($row);
            if (is_wp_error($userId)) {
                $failed++;
                continue;
            }
        }

        if ($userId && get_user_by('id', $userId)) {
            $userIds[] = $userId;
            continue;
        }

        $failed++;
    }

    $userIds = array_values(array_unique(array_map('absint', $userIds)));

    return [
        'user_ids'    => $userIds,
        'failed'      => $failed,
        'has_more'    => $hasMore,
        'next_offset' => $offset + count($rows),
    ];
}

function jpv_fcom_bulk_add_space_members(WP_REST_Request $request)
{
    $space = jpv_fcom_get_space_by_slug($request['spaceSlug']);
    if (!$space) {
        return new WP_Error('jpv_fcom_space_not_found', __('Space not found', 'fluent-community'), ['status' => 404]);
    }

    $userIds = $request->get_param('user_ids');
    if (!is_array($userIds)) {
        return new WP_Error('jpv_fcom_missing_user_ids', 'user_ids must be an array', ['status' => 400]);
    }

    $added = 0;
    $skipped = 0;
    $failed = 0;

    foreach (array_unique(array_map('absint', $userIds)) as $userId) {
        if (!$userId || !get_user_by('id', $userId)) {
            $failed++;
            continue;
        }

        if (jpv_fcom_is_user_in_space($space->id, $userId)) {
            $skipped++;
            continue;
        }

        if (class_exists('\FluentCommunity\App\Services\Helper') && \FluentCommunity\App\Services\Helper::addToSpace($space, $userId, 'member', 'by_admin')) {
            $added++;
            continue;
        }

        $failed++;
    }

    return [
        'added'     => $added,
        'skipped'   => $skipped,
        'failed'    => $failed,
        'processed' => $added + $skipped + $failed,
    ];
}

function jpv_fcom_get_space_by_slug($slug)
{
    if (!class_exists('\FluentCommunity\App\Models\Space')) {
        return null;
    }

    return \FluentCommunity\App\Models\Space::where('slug', sanitize_title($slug))->first();
}

function jpv_fcom_is_user_in_space($spaceId, $userId)
{
    global $wpdb;

    $table = $wpdb->prefix . 'fcom_space_user';

    return (bool) $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM {$table} WHERE space_id = %d AND user_id = %d AND status = %s LIMIT 1",
        $spaceId,
        $userId,
        'active'
    ));
}

function jpv_fcom_create_wp_user_from_crm_row($row)
{
    $email = sanitize_email($row->email);
    if (!is_email($email)) {
        return new WP_Error('jpv_fcom_invalid_email', 'Invalid email');
    }

    $base = sanitize_user(current(explode('@', $email)), true);
    if (!$base) {
        $base = 'member';
    }

    $username = $base;
    $suffix = 1;
    while (username_exists($username)) {
        $username = $base . $suffix;
        $suffix++;
    }

    $userId = wp_insert_user([
        'user_login'   => $username,
        'user_email'   => $email,
        'user_pass'    => wp_generate_password(24, true),
        'first_name'   => sanitize_text_field((string) $row->first_name),
        'last_name'    => sanitize_text_field((string) $row->last_name),
        'display_name' => trim(sanitize_text_field((string) $row->first_name . ' ' . (string) $row->last_name)) ?: $email,
        'role'         => get_option('default_role', 'subscriber'),
    ]);

    return $userId;
}

<?php
wp_set_current_user(1);

$resolve = new WP_REST_Request('POST', '/fluent-community/v2/spaces/only-vip-discussion/members/resolve-crm-tag');
$resolve->set_param('tag_id', 5);
$resolve->set_param('create_missing', false);
$resolve->set_param('offset', 0);
$resolve->set_param('per_page', 1);
$resolveResponse = rest_do_request($resolve);
echo 'resolve_status=' . $resolveResponse->get_status() . PHP_EOL;
echo wp_json_encode($resolveResponse->get_data()) . PHP_EOL;

$bulk = new WP_REST_Request('POST', '/fluent-community/v2/spaces/only-vip-discussion/members/bulk-add');
$bulk->set_param('user_ids', []);
$bulkResponse = rest_do_request($bulk);
echo 'bulk_status=' . $bulkResponse->get_status() . PHP_EOL;
echo wp_json_encode($bulkResponse->get_data()) . PHP_EOL;

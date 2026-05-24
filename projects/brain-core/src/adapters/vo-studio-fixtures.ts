/**
 * VO Studio Read Model — Fixture Data
 *
 * Represents a complete, realistic VO operational state.
 * Used by fixture-backed adapters for tests and read-only development.
 */

export const brandProfiles = [
  {
    id: 'brand-yeshua',
    label: 'Yeshua Academy',
    brand_line: 'YeshuaAcademy.com',
    label_text: 'BIBLE STUDY',
    accent_color: '#F5C842',
    logo_path: '/assets/yeshua-logo.png',
  },
];

export const projects = [
  {
    id: 'proj-yeshua-main',
    name: 'YeshuaAcademy.com Main Channel',
    description: 'Genesis through Revelation Bible teaching series',
    status: 'active',
    brand_profile_id: 'brand-yeshua',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-05-24T14:30:00Z',
  },
];

export const platformSpecs = [
  {
    id: 'youtube',
    label: 'YouTube',
    enabled: true,
    direct_upload_handler: 'youtube',
    capabilities: ['video/1080p', 'captions', 'thumbnails', 'metadata', 'analytics'],
    max_video_size_mb: 256000,
    max_duration_sec: 86400,
    accepted_formats: ['landscape_1920x1080_16x9', 'vertical_1080x1920_9x16'],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    enabled: true,
    direct_upload_handler: null, // n8n dispatch
    capabilities: ['video/1080p', 'metadata'],
    max_video_size_mb: 4000,
    max_duration_sec: 7200,
    accepted_formats: ['landscape_1920x1080_16x9', 'vertical_1080x1920_9x16'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    enabled: false,
    direct_upload_handler: null,
    capabilities: ['video/1080p', 'metadata'],
    max_video_size_mb: 287,
    max_duration_sec: 600,
    accepted_formats: ['vertical_1080x1920_9x16'],
  },
];

export const formatSpecs = [
  {
    id: 'landscape_1920x1080_16x9',
    label: 'Landscape 1080p (16:9)',
    width: 1920,
    height: 1080,
    aspect_ratio: '16:9',
    platforms: ['youtube', 'facebook'],
  },
  {
    id: 'vertical_1080x1920_9x16',
    label: 'Vertical Full (9:16)',
    width: 1080,
    height: 1920,
    aspect_ratio: '9:16',
    platforms: ['youtube', 'facebook', 'tiktok'],
  },
];

export const platformAccounts = [
  {
    id: 'acc-yt-yeshua',
    project_id: 'proj-yeshua-main',
    platform_id: 'youtube',
    account_handle: '@YeshuaAcademy',
    display_name: 'Yeshua Academy',
    email: 'channel@yeshuaacademy.com',
    credential_state: 'configured',
    adapter_mode: 'direct',
    quota_remaining: 9500,
    quota_reset_at: '2026-05-25T00:00:00Z',
    enabled_profiles: ['pipe-genesis', 'pipe-exodus'],
    created_at: '2025-06-01T00:00:00Z',
    last_verified_at: '2026-05-24T12:00:00Z',
  },
  {
    id: 'acc-fb-yeshua',
    project_id: 'proj-yeshua-main',
    platform_id: 'facebook',
    account_handle: 'yeshuaacademy',
    display_name: 'Yeshua Academy',
    email: null,
    credential_state: 'configured',
    adapter_mode: 'n8n-dispatch',
    quota_remaining: null,
    quota_reset_at: null,
    enabled_profiles: ['pipe-genesis'],
    created_at: '2025-07-15T00:00:00Z',
    last_verified_at: '2026-05-20T15:30:00Z',
  },
  {
    id: 'acc-tiktok-yeshua-disabled',
    project_id: 'proj-yeshua-main',
    platform_id: 'tiktok',
    account_handle: 'yeshuaacademy_shorts',
    display_name: 'Yeshua Academy (TikTok)',
    email: null,
    credential_state: 'missing',
    adapter_mode: 'manual-only',
    quota_remaining: null,
    quota_reset_at: null,
    enabled_profiles: [],
    created_at: '2026-01-10T00:00:00Z',
    last_verified_at: null,
  },
];

export const pipelineProfiles = [
  {
    id: 'pipe-genesis',
    name: 'Genesis Series Pipeline',
    project_id: 'proj-yeshua-main',
    enabled: true,
    stages: ['normalize', 'subtitle', 'compose', 'thumbnail', 'metadata', 'publish'],
    target_platforms: ['youtube', 'facebook'],
    created_at: '2025-06-15T00:00:00Z',
    updated_at: '2026-05-24T10:00:00Z',
  },
  {
    id: 'pipe-exodus',
    name: 'Exodus Series Pipeline',
    project_id: 'proj-yeshua-main',
    enabled: true,
    stages: ['normalize', 'subtitle', 'compose', 'thumbnail', 'metadata', 'publish'],
    target_platforms: ['youtube'],
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2026-05-24T10:00:00Z',
  },
];

export const contentItems = [
  {
    id: 'item-gen-01',
    project_id: 'proj-yeshua-main',
    title: 'Genesis 1 - Creation & Beginning',
    description: 'Overview of creation account and the beginning of God\'s story',
    status: 'published',
    source_audio_path: '/sources/genesis-01.mp3',
    background_image_path: '/sources/genesis-series-bg.jpg',
    duration_sec: 1847,
    language: 'en',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-05-20T14:00:00Z',
  },
  {
    id: 'item-gen-02',
    project_id: 'proj-yeshua-main',
    title: 'Genesis 2-3 - Garden & Temptation',
    description: 'The garden of Eden and the fall of humanity',
    status: 'approved',
    source_audio_path: '/sources/genesis-02-03.mp3',
    background_image_path: '/sources/genesis-series-bg.jpg',
    duration_sec: 2145,
    language: 'en',
    created_at: '2026-03-08T00:00:00Z',
    updated_at: '2026-05-23T16:00:00Z',
  },
  {
    id: 'item-gen-03',
    project_id: 'proj-yeshua-main',
    title: 'Genesis 4-5 - First Families',
    description: 'Cain and Abel, Seth, and the genealogy of Adam',
    status: 'in_progress',
    source_audio_path: '/sources/genesis-04-05.mp3',
    background_image_path: '/sources/genesis-series-bg.jpg',
    duration_sec: null,
    language: 'en',
    created_at: '2026-05-24T08:00:00Z',
    updated_at: '2026-05-24T14:30:00Z',
  },
];

export const packages = [
  {
    id: 'pkg-gen-01-yt-fb',
    content_item_id: 'item-gen-01',
    project_id: 'proj-yeshua-main',
    pipeline_profile_id: 'pipe-genesis',
    status: 'published',
    stage: 'completed',
    artifacts: [
      {
        id: 'variant_a',
        type: 'thumbnail',
        path: '/output/pkg-gen-01/thumb-a.jpg',
        metadata: { template: 'bold-text', winner: true },
        active: true,
      },
      {
        id: 'variant_b',
        type: 'thumbnail',
        path: '/output/pkg-gen-01/thumb-b.jpg',
        metadata: { template: 'minimal-curiosity', loser: true },
        active: false,
      },
    ],
    approvals: [
      {
        id: 'appr-thumb',
        package_id: 'pkg-gen-01-yt-fb',
        type: 'thumbnail',
        status: 'approved',
        required_fields: ['variant_a_path', 'variant_b_path'],
        approved_by: 'operator@yeshuaacademy.com',
        rejected_by: null,
        requested_at: '2026-03-01T10:00:00Z',
        responded_at: '2026-03-01T11:00:00Z',
        notes: 'Both variants look good, variant A has better hook',
      },
    ],
    posting_targets: [
      {
        id: 'target-gen-01-yt',
        package_id: 'pkg-gen-01-yt-fb',
        platform_id: 'youtube',
        account_id: 'acc-yt-yeshua',
        status: 'published',
        scheduled_at: null,
        published_at: '2026-03-01T18:00:00Z',
        published_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        error: null,
      },
      {
        id: 'target-gen-01-fb',
        package_id: 'pkg-gen-01-yt-fb',
        platform_id: 'facebook',
        account_id: 'acc-fb-yeshua',
        status: 'published',
        scheduled_at: null,
        published_at: '2026-03-01T18:15:00Z',
        published_url: 'https://facebook.com/yeshuaacademy/videos/123456789',
        error: null,
      },
    ],
    audit_events: [
      {
        id: 'evt-1',
        package_id: 'pkg-gen-01-yt-fb',
        timestamp: '2026-03-01T09:00:00Z',
        event_type: 'job_started',
        actor: 'system',
        details: { stage: 'composition' },
      },
      {
        id: 'evt-2',
        package_id: 'pkg-gen-01-yt-fb',
        timestamp: '2026-03-01T18:00:00Z',
        event_type: 'job_completed',
        actor: 'system',
        details: { stage: 'publish', platforms: ['youtube', 'facebook'] },
      },
    ],
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-03-01T18:15:00Z',
    approved_at: '2026-03-01T11:00:00Z',
    published_at: '2026-03-01T18:15:00Z',
  },
];

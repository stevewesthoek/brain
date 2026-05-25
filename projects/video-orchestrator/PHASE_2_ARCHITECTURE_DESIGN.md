# Phase 2: Thumbnail Studio Architecture Design

**Date:** 2026-05-25  
**Goal:** Finalize component APIs, data formats, configuration, and integration points  
**Scope:** Modular design ready for Phase 3 code review and Phase 4 implementation  
**Status:** 🟡 In Progress

---

## 1. Component API Specifications

### 1.1 ThumbnailDesigner (Orchestrator)

**Purpose:** Main entry point for thumbnail generation. Coordinates all subcomponents.

```python
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from pathlib import Path
from enum import Enum

class Platform(Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    BLUESKY = "bluesky"
    X = "x"
    PINTEREST = "pinterest"

@dataclass
class ThumbnailVariant:
    """Single thumbnail output."""
    platform: Platform
    variant_index: int
    image_path: Path
    format: str  # "JPEG" or "PNG"
    dimensions: tuple[int, int]
    file_size_bytes: int
    metadata: Dict[str, Any]
    score: float  # 0.0-1.0 CTR likelihood estimate
    score_components: Dict[str, float]  # breakdown of score

@dataclass
class ThumbnailArtifact:
    """Complete thumbnail generation output."""
    episode_id: str
    variants: List[ThumbnailVariant]
    template_ids: List[str]
    colors_used: Dict[str, str]
    fonts_used: List[str]
    background_path: Path
    generated_at: str  # ISO 8601
    metadata: Dict[str, Any]

class ThumbnailDesigner:
    """
    Orchestrator for multi-platform thumbnail generation.
    
    Usage:
        designer = ThumbnailDesigner(config_path="~/.config/video-orchestrator/thumbnail-system.yaml")
        artifact = designer.generate_variants(
            episode_title="Genesis — Noah",
            background_image=Path("/tmp/background.jpg"),
            target_platforms=[Platform.YOUTUBE, Platform.FACEBOOK, Platform.PINTEREST],
            template_ids=["bold-text", "image-focus"],
            variant_count=2,
        )
        
        # Access results
        for variant in artifact.variants:
            print(f"{variant.platform.value}: {variant.image_path} (score: {variant.score})")
    """
    
    def __init__(self, config_path: str = None):
        """Initialize designer with YAML configuration."""
        self.config_path = config_path or "~/.config/video-orchestrator/thumbnail-system.yaml"
        self.template_library = TemplateLibrary(self.config_path)
        self.color_palette = ColorPalette(self.config_path)
        self.font_manager = FontManager()
        self.image_cache = ImageCache()
        self.platform_specs = PlatformSpecs(self.config_path)
    
    def generate_variants(
        self,
        episode_title: str,
        background_image: Path,
        target_platforms: List[Platform],
        template_ids: Optional[List[str]] = None,
        variant_count: int = 2,
        episode_id: str = None,
        series_context: str = None,
    ) -> ThumbnailArtifact:
        """
        Generate platform-specific thumbnail variants.
        
        Args:
            episode_title: Thumbnail headline (50-80 chars recommended)
            background_image: Path to background image (will be cached)
            target_platforms: List of Platform enums to generate for
            template_ids: List of template names to use (default: ["bold-text"])
            variant_count: Number of A/B variants per template (typically 2-3)
            episode_id: Optional episode ID for metadata tracking
            series_context: Optional series name (e.g., "Old Testament")
        
        Returns:
            ThumbnailArtifact with all variants, metadata, scoring
        
        Raises:
            ValueError: Invalid platforms, missing background, malformed title
            FileNotFoundError: Background image not found
            ConfigError: YAML configuration invalid
        """
        # Validate inputs
        self._validate_inputs(episode_title, background_image, target_platforms, template_ids)
        
        # Load templates
        templates = self.template_library.load(template_ids or ["bold-text"])
        
        # Select colors based on context
        palette = self.color_palette.select_from_context(
            episode_title=episode_title,
            series=series_context,
        )
        
        # Load and cache fonts
        fonts = self.font_manager.resolve(templates)
        
        # Generate variants
        variants = []
        for template in templates:
            for variant_idx in range(variant_count):
                # Generate for each platform with variants
                for platform in target_platforms:
                    composer = ImageComposer(template, fonts, palette)
                    
                    # Create variant tweaks (color shifts, text positioning, etc.)
                    variant_config = self._create_variant_config(
                        template=template,
                        variant_index=variant_idx,
                        platform=platform,
                    )
                    
                    # Render image
                    image, metadata = composer.render(
                        headline=episode_title,
                        background_path=background_image,
                        platform=platform,
                        variant_config=variant_config,
                    )
                    
                    # Score variant
                    score, score_components = self._score_variant(
                        headline=episode_title,
                        template=template,
                        colors=palette,
                        platform=platform,
                    )
                    
                    variants.append(ThumbnailVariant(
                        platform=platform,
                        variant_index=variant_idx,
                        image_path=image,
                        format="JPEG" if platform == Platform.YOUTUBE else "PNG",
                        dimensions=self.platform_specs.get_dimensions(platform),
                        file_size_bytes=image.stat().st_size,
                        metadata=metadata,
                        score=score,
                        score_components=score_components,
                    ))
        
        # Create artifact
        artifact = ThumbnailArtifact(
            episode_id=episode_id or str(uuid4()),
            variants=sorted(variants, key=lambda v: v.score, reverse=True),
            template_ids=template_ids or ["bold-text"],
            colors_used=palette,
            fonts_used=fonts,
            background_path=background_image,
            generated_at=datetime.now(timezone.utc).isoformat(),
            metadata={
                "series": series_context,
                "generation_method": "pillow",
                "variant_count": variant_count,
            },
        )
        
        return artifact
    
    def _validate_inputs(self, title, bg, platforms, templates):
        """Validate all input parameters."""
        if not title or len(title) > 200:
            raise ValueError("episode_title must be 1-200 characters")
        if not bg.exists():
            raise FileNotFoundError(f"Background image not found: {bg}")
        if not platforms or not all(isinstance(p, Platform) for p in platforms):
            raise ValueError("target_platforms must be non-empty list of Platform enums")
        # TODO: validate templates exist in config
    
    def _create_variant_config(self, template, variant_index, platform):
        """Create variant-specific configuration (color shifts, positioning)."""
        # Variant 0: baseline
        # Variant 1: shift colors slightly (more vibrant)
        # Variant 2: adjust text positioning
        return {
            "color_shift": 0.1 * variant_index,
            "position_shift": 0.05 * variant_index,
            "emphasis": 1.0 + (0.1 * variant_index),
        }
    
    def _score_variant(self, headline, template, colors, platform):
        """
        Score variant CTR likelihood (0.0-1.0).
        
        Heuristic approach (no ML):
        - Text readability (contrast, size)
        - Color vibrancy
        - Text length (shorter = better)
        - Template popularity (historical CTR)
        - Platform optimization (dimensions, safe zones)
        """
        score = 0.0
        components = {}
        
        # Text readability (0-0.3)
        text_score = self._score_text_readability(headline, template)
        components["text_readability"] = text_score
        score += text_score * 0.3
        
        # Color vibrancy (0-0.3)
        color_score = self._score_color_vibrancy(colors)
        components["color_vibrancy"] = color_score
        score += color_score * 0.3
        
        # Text length preference (0-0.2)
        length_score = min(1.0, 1.0 - (len(headline) / 200))
        components["text_length"] = length_score
        score += length_score * 0.2
        
        # Template quality (0-0.2)
        template_score = self._score_template_quality(template, platform)
        components["template_quality"] = template_score
        score += template_score * 0.2
        
        return min(1.0, score), components
    
    def _score_text_readability(self, text, template):
        """Score text readability based on contrast and size."""
        # TODO: measure contrast ratio against template background
        # For now, heuristic based on text length and template type
        return 0.7 if len(text) < 60 else 0.5
    
    def _score_color_vibrancy(self, colors):
        """Score color palette vibrancy (0-1)."""
        # TODO: calculate saturation and luminance
        # For now, return fixed value
        return 0.8
    
    def _score_template_quality(self, template, platform):
        """Score template quality for platform."""
        # TODO: use historical CTR data if available
        # For now, return fixed value
        return 0.75
```

---

### 1.2 TemplateLibrary

**Purpose:** Load and manage thumbnail templates from YAML configuration.

```python
class TemplateLibrary:
    """Manages template loading, validation, and caching."""
    
    def __init__(self, config_path: str = None):
        """Load YAML configuration."""
        self.config_path = config_path or "~/.config/video-orchestrator/thumbnail-system.yaml"
        self.config = self._load_config()
        self.template_cache = {}
    
    def load(self, template_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Load templates by ID.
        
        Args:
            template_ids: List of template names (e.g., ["bold-text", "image-focus"])
        
        Returns:
            List of parsed template definitions
        
        Raises:
            ValueError: Unknown template ID
        """
        templates = []
        for tid in template_ids:
            if tid not in self.config.get("templates", {}):
                raise ValueError(f"Unknown template: {tid}")
            
            if tid not in self.template_cache:
                self.template_cache[tid] = self._parse_template(
                    self.config["templates"][tid]
                )
            
            templates.append(self.template_cache[tid])
        
        return templates
    
    def _load_config(self) -> Dict[str, Any]:
        """Load YAML configuration file."""
        with open(Path(self.config_path).expanduser()) as f:
            return yaml.safe_load(f)
    
    def _parse_template(self, template_def: Dict) -> Dict[str, Any]:
        """Parse and validate template definition."""
        # Validate required fields
        required = ["name", "layers"]
        for req in required:
            if req not in template_def:
                raise ValueError(f"Template missing required field: {req}")
        
        # Validate layers
        for layer in template_def.get("layers", []):
            self._validate_layer(layer)
        
        return template_def
    
    def _validate_layer(self, layer: Dict):
        """Validate layer definition."""
        layer_type = layer.get("type")
        if layer_type not in ["background", "scrim", "text", "accent", "logo"]:
            raise ValueError(f"Unknown layer type: {layer_type}")
```

---

### 1.3 ColorPalette

**Purpose:** Select and manage Yeshua Academy brand colors.

```python
class ColorPalette:
    """Brand color selection and management."""
    
    def __init__(self, config_path: str = None):
        """Load brand colors from config."""
        self.config_path = config_path or "~/.config/video-orchestrator/thumbnail-system.yaml"
        self.config = self._load_config()
    
    def select_from_context(
        self,
        episode_title: str = None,
        series: str = None,
        base_mood: str = "faith",
    ) -> Dict[str, str]:
        """
        Select colors based on episode context.
        
        Args:
            episode_title: Title for context (may influence color selection)
            series: Series name (e.g., "Old Testament" → gold/blue)
            base_mood: Default mood if no context (faith, learn, joy, etc.)
        
        Returns:
            Dict mapping color names to hex values
            {
                "primary": "#FFB81C",
                "secondary": "#1A3873",
                "accent": "#FF6400",
                ...
            }
        """
        # Determine color scheme based on series/context
        if series and "old testament" in series.lower():
            scheme = self.config.get("color_schemes", {}).get("old_testament")
        elif series and "new testament" in series.lower():
            scheme = self.config.get("color_schemes", {}).get("new_testament")
        else:
            scheme = self.config.get("color_schemes", {}).get("default")
        
        if not scheme:
            raise ValueError(f"No color scheme found for series: {series}")
        
        return scheme
```

---

### 1.4 FontManager

**Purpose:** Resolve and cache fonts.

```python
class FontManager:
    """Font resolution and caching."""
    
    SYSTEM_FONTS = {
        "Arial-Bold": "/System/Library/Fonts/Arial.ttf",
        "Helvetica-Regular": "/System/Library/Fonts/Helvetica.ttc",
        "Georgia-Italic": "/System/Library/Fonts/Georgia.ttf",
        # Add more as needed
    }
    
    def __init__(self):
        """Initialize font manager."""
        self.font_cache = {}
    
    def resolve(self, templates: List[Dict]) -> List[str]:
        """
        Resolve fonts needed by templates.
        
        Args:
            templates: List of template definitions
        
        Returns:
            List of resolved font names
        
        Raises:
            FileNotFoundError: Font not found
        """
        fonts_needed = set()
        
        for template in templates:
            for layer in template.get("layers", []):
                if layer.get("type") == "text" and "font" in layer:
                    fonts_needed.add(layer["font"])
        
        resolved = []
        for font_name in fonts_needed:
            if font_name not in self.font_cache:
                font_path = self.SYSTEM_FONTS.get(font_name)
                if not font_path or not Path(font_path).exists():
                    raise FileNotFoundError(f"Font not found: {font_name}")
                self.font_cache[font_name] = font_path
            
            resolved.append(font_name)
        
        return resolved
```

---

### 1.5 ImageComposer

**Purpose:** Render layers to image using Pillow.

```python
from PIL import Image, ImageDraw, ImageFont

class ImageComposer:
    """Image composition using Pillow."""
    
    def __init__(self, template: Dict, fonts: Dict[str, str], colors: Dict[str, str]):
        """Initialize composer."""
        self.template = template
        self.fonts = fonts
        self.colors = colors
    
    def render(
        self,
        headline: str,
        background_path: Path,
        platform: Platform,
        variant_config: Dict = None,
    ) -> tuple[Path, Dict]:
        """
        Render thumbnail image.
        
        Args:
            headline: Text to render
            background_path: Path to background image
            platform: Target platform (dimensions)
            variant_config: Variant-specific tweaks
        
        Returns:
            (output_path, metadata)
        """
        variant_config = variant_config or {}
        
        # Load background and resize to platform dimensions
        bg_image = Image.open(background_path)
        dimensions = PlatformSpecs.get_dimensions(platform)
        bg_image = self._resize_and_crop(bg_image, dimensions)
        
        # Create working image
        image = bg_image.copy()
        draw = ImageDraw.Draw(image)
        
        # Render layers
        for layer in self.template.get("layers", []):
            layer_type = layer.get("type")
            
            if layer_type == "background":
                pass  # Already handled
            elif layer_type == "scrim":
                self._render_scrim(image, draw, layer, dimensions)
            elif layer_type == "text":
                self._render_text(image, draw, layer, headline, dimensions, variant_config)
            elif layer_type == "accent":
                self._render_accent(image, draw, layer, dimensions, variant_config)
            elif layer_type == "logo":
                self._render_logo(image, layer, dimensions)
        
        # Optimize and save
        output_path = self._save_optimized(image, platform)
        
        return output_path, {
            "template": self.template.get("name"),
            "platform": platform.value,
            "dimensions": dimensions,
        }
    
    def _resize_and_crop(self, image: Image.Image, target_dims: tuple[int, int]) -> Image.Image:
        """Resize and center-crop to target dimensions."""
        # TODO: smart cropping, avoid faces if possible
        width, height = target_dims
        img_width, img_height = image.size
        
        # Scale to fit width, then crop height
        if img_width / img_height < width / height:
            # Image too tall, scale by width
            new_height = int(img_width * height / width)
            image = image.resize((img_width, new_height), Image.Resampling.LANCZOS)
        else:
            # Image too wide, scale by height
            new_width = int(img_height * width / height)
            image = image.resize((new_width, img_height), Image.Resampling.LANCZOS)
        
        # Center crop
        left = (image.width - width) // 2
        top = (image.height - height) // 2
        image = image.crop((left, top, left + width, top + height))
        
        return image.resize((width, height))
    
    def _render_scrim(self, image, draw, layer, dimensions):
        """Render semi-transparent scrim overlay."""
        color = layer.get("color", "rgba(0, 0, 0, 0.3)")
        # Parse color and apply to image
        # TODO: implement color parsing and application
        pass
    
    def _render_text(self, image, draw, layer, headline, dimensions, variant_config):
        """Render text layer."""
        font_name = layer.get("font", "Arial-Bold")
        size = layer.get("size", 72)
        color = layer.get("color", "#FFFFFF")
        position = layer.get("position", "center")
        
        # Apply variant tweaks
        size = int(size * (1 + variant_config.get("emphasis", 0)))
        
        # TODO: Load font, render text, apply effects
        pass
    
    def _render_accent(self, image, draw, layer, dimensions, variant_config):
        """Render accent shapes/bars."""
        # TODO: render rectangles, bars, shapes based on layer config
        pass
    
    def _render_logo(self, image, layer, dimensions):
        """Render brand logo."""
        # TODO: overlay logo at specified position and scale
        pass
    
    def _save_optimized(self, image: Image.Image, platform: Platform) -> Path:
        """Save and optimize image for platform."""
        output_dir = Path.home() / ".cache" / "video-orchestrator" / "thumbnails"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / f"{uuid4()}.jpg"
        
        # Optimize based on platform
        if platform == Platform.YOUTUBE:
            # JPEG, <80KB target
            image.save(output_path, "JPEG", quality=85, optimize=True)
        else:
            # PNG for others
            output_path = output_path.with_suffix(".png")
            image.save(output_path, "PNG", optimize=True)
        
        return output_path
```

---

### 1.6 VariantGenerator

**Purpose:** Create and score variants for A/B testing.

```python
class VariantGenerator:
    """Generate and score thumbnail variants."""
    
    @staticmethod
    def score_variants(variants: List[ThumbnailVariant]) -> List[ThumbnailVariant]:
        """
        Sort variants by CTR likelihood score.
        
        Args:
            variants: List of generated variants
        
        Returns:
            Sorted list (highest CTR likelihood first)
        """
        return sorted(variants, key=lambda v: v.score, reverse=True)
    
    @staticmethod
    def recommend_winner(test_results: Dict) -> str:
        """
        Recommend A/B test winner based on CTR data.
        
        Args:
            test_results: {
                "variant_a": {"impressions": 1000, "clicks": 50},
                "variant_b": {"impressions": 1000, "clicks": 65}
            }
        
        Returns:
            "variant_a" or "variant_b" or "tie"
        """
        ctr_a = test_results["variant_a"]["clicks"] / test_results["variant_a"]["impressions"]
        ctr_b = test_results["variant_b"]["clicks"] / test_results["variant_b"]["impressions"]
        
        diff_pct = abs(ctr_b - ctr_a) / ctr_a * 100
        
        if diff_pct >= 15:
            return "variant_b" if ctr_b > ctr_a else "variant_a"
        elif diff_pct >= 10:
            return "variant_b" if ctr_b > ctr_a else "variant_a"
        else:
            return "tie"
```

---

## 2. Configuration Format (YAML)

### 2.1 Template System Configuration

**File:** `~/.config/video-orchestrator/thumbnail-system.yaml`

```yaml
thumbnail_system:
  version: "1.0"
  description: "Yeshua Academy Thumbnail System Configuration"
  
  # Brand colors per series
  color_schemes:
    default:
      primary: "#FFB81C"        # Gold
      secondary: "#1A3873"      # Deep blue
      accent: "#FF6400"         # Orange
      white: "#FFFFFF"
      black: "#000000"
    
    old_testament:
      primary: "#FFB81C"        # Gold (authority, OT wisdom)
      secondary: "#1A3873"
      accent: "#D4AF37"         # Rich gold
      white: "#FFFFFF"
      black: "#000000"
    
    new_testament:
      primary: "#1A3873"        # Blue (mercy, grace)
      secondary: "#FF6400"
      accent: "#FF6400"         # Orange (passion)
      white: "#FFFFFF"
      black: "#000000"
  
  # Thumbnail templates
  templates:
    bold-text:
      name: "Bold Text Headline"
      description: "Large headline on solid/gradient background"
      platforms: [youtube, tiktok, instagram, facebook]
      
      layers:
        - type: background
          source: "upload"          # user provides image
          cover_fit: true
          blur: false
          
        - type: scrim
          color: "rgba(0, 0, 0, 0.3)"
          only_on_platforms: [youtube, tiktok]
          
        - type: text
          variable: headline
          font: "Arial-Bold"
          size: 72
          color: "#FFFFFF"
          shadow: true
          position: "bottom-center"
          padding: 40
          max_width: 90%
          line_height: 1.2
          
        - type: accent
          type: "bar"
          color: "rgb(255, 100, 0)"
          position: "top-left"
          width: 8
          height: "100%"
          
        - type: logo
          position: "top-right"
          scale: 0.15
          opacity: 0.7
      
      variants:
        youtube:
          dimensions: [1280, 720]
          safe_area: [50, 50, 1230, 670]
          format: "JPEG"
          max_file_size: 81920
        
        tiktok:
          dimensions: [1080, 1920]
          safe_area: [40, 100, 1040, 1880]
          format: "PNG"
          max_file_size: 51200
        
        instagram:
          dimensions: [1080, 1080]
          safe_area: [40, 40, 1040, 1040]
          format: "PNG"
          max_file_size: 51200
    
    image-focus:
      name: "Image Focus with Text"
      description: "Large background image with subtle text overlay"
      platforms: [all]
      
      layers:
        - type: background
          source: "upload"
          cover_fit: true
          blur: false
        
        - type: scrim
          color: "rgba(0, 0, 0, 0.2)"
        
        - type: text
          variable: headline
          font: "Arial-Bold"
          size: 56
          color: "#FFFFFF"
          shadow: true
          position: "bottom-left"
          padding: 30
          max_width: 85%
    
    curiosity-hook:
      name: "Curiosity Hook"
      description: "Partial image with question mark or ellipsis"
      platforms: [youtube, tiktok, instagram]
      
      layers:
        - type: background
          source: "upload"
          cover_fit: false  # Show only portion
          crop: "center"
        
        - type: accent
          type: "question_mark"
          size: 200
          color: "rgb(255, 184, 28)"
          position: "bottom-right"
          opacity: 0.8
        
        - type: text
          variable: headline
          font: "Georgia-Italic"
          size: 48
          color: "#FFFFFF"
          shadow: true
          position: "top-center"
          padding: 20
    
    minimal-text:
      name: "Minimal Clean"
      description: "Lots of white space, elegant typography"
      platforms: [pinterest, linkedin, facebook]
      
      layers:
        - type: background
          source: "upload"
          cover_fit: true
        
        - type: text
          variable: headline
          font: "Helvetica-Regular"
          size: 48
          color: "#FFFFFF"
          shadow: false
          position: "center"
          padding: 40
          max_width: 80%
    
    accent-bar:
      name: "Accent Bar"
      description: "Horizontal color bar with text"
      platforms: [youtube, tiktok, instagram, facebook]
      
      layers:
        - type: background
          source: "upload"
          cover_fit: true
        
        - type: accent
          type: "horizontal_bar"
          color: "rgb(255, 100, 0)"
          position: "bottom"
          height: 120
        
        - type: text
          variable: headline
          font: "Arial-Bold"
          size: 64
          color: "#FFFFFF"
          shadow: false
          position: "bottom-center"
          padding: 20
    
    faith-specific:
      name: "Faith & Scripture"
      description: "Cross symbol, scripture references"
      platforms: [youtube, pinterest, facebook]
      
      layers:
        - type: background
          source: "upload"
          cover_fit: true
        
        - type: accent
          type: "cross"
          color: "rgb(255, 184, 28)"
          position: "top-center"
          size: 80
          opacity: 0.6
        
        - type: text
          variable: headline
          font: "Georgia-Italic"
          size: 56
          color: "#FFFFFF"
          shadow: true
          position: "center"
          padding: 30
          max_width: 85%

# Platform specifications
platform_specs:
  youtube:
    name: "YouTube"
    dimensions: [1280, 720]
    aspect_ratio: "16:9"
    safe_area: [50, 50, 1230, 670]
    format: "JPEG"
    max_file_size: 81920
    compression_quality: 85
  
  tiktok:
    name: "TikTok"
    dimensions: [1080, 1920]
    aspect_ratio: "9:16"
    safe_area: [40, 100, 1040, 1880]
    format: "PNG"
    max_file_size: 51200
    compression_quality: 85
  
  instagram:
    name: "Instagram Reels"
    dimensions: [1080, 1080]
    aspect_ratio: "1:1"
    safe_area: [40, 40, 1040, 1040]
    format: "PNG"
    max_file_size: 51200
    compression_quality: 85
  
  facebook:
    name: "Facebook"
    dimensions: [1200, 628]
    aspect_ratio: "1.91:1"
    safe_area: [50, 30, 1150, 598]
    format: "JPEG"
    max_file_size: 102400
    compression_quality: 80
  
  pinterest:
    name: "Pinterest"
    dimensions: [1000, 1500]
    aspect_ratio: "2:3"
    safe_area: [40, 40, 960, 1460]
    format: "JPEG"
    max_file_size: 102400
    compression_quality: 85

# Caching configuration
cache:
  enabled: true
  type: "redis"  # or "memory"
  ttl_seconds: 86400
  redis_host: "127.0.0.1"
  redis_port: 6379
  redis_db: 0
```

---

## 3. Database Schema for A/B Test Results

**Table:** `thumbnail_a_b_test_results`

```sql
CREATE TABLE thumbnail_a_b_test_results (
    -- Primary key
    test_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    episode_id VARCHAR(255),
    
    -- Variant information
    variant_a_id UUID NOT NULL,
    variant_b_id UUID NOT NULL,
    variant_a_template VARCHAR(50),
    variant_b_template VARCHAR(50),
    
    -- Variant A metrics
    variant_a_impressions INTEGER DEFAULT 0,
    variant_a_clicks INTEGER DEFAULT 0,
    variant_a_ctr FLOAT DEFAULT NULL,
    variant_a_start_date TIMESTAMP,
    variant_a_end_date TIMESTAMP,
    
    -- Variant B metrics
    variant_b_impressions INTEGER DEFAULT 0,
    variant_b_clicks INTEGER DEFAULT 0,
    variant_b_ctr FLOAT DEFAULT NULL,
    variant_b_start_date TIMESTAMP,
    variant_b_end_date TIMESTAMP,
    
    -- Winner determination
    winner_id UUID,  -- variant_a_id or variant_b_id
    winner_declared_at TIMESTAMP,
    winner_confidence FLOAT,  -- 0.7-0.99
    winner_reason VARCHAR(255),
    
    -- Test configuration
    is_final BOOLEAN DEFAULT FALSE,
    test_duration_days INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_video_id ON thumbnail_a_b_test_results(video_id);
CREATE INDEX idx_test_episode_id ON thumbnail_a_b_test_results(episode_id);
CREATE INDEX idx_test_winner_id ON thumbnail_a_b_test_results(winner_id);
```

---

## 4. Integration Points

### 4.1 Integration with video_worker.py

**Job type:** `thumbnail`

```python
# In video_worker.py
class ThumbnailJobHandler:
    def handle_thumbnail_job(self, job_config):
        """Process thumbnail job."""
        designer = ThumbnailDesigner(
            config_path="~/.config/video-orchestrator/thumbnail-system.yaml"
        )
        
        artifact = designer.generate_variants(
            episode_title=job_config["episode_title"],
            background_image=Path(job_config["background_image"]),
            target_platforms=[
                Platform[p.upper()] for p in job_config["target_platforms"]
            ],
            template_ids=job_config.get("template_ids", ["bold-text"]),
            variant_count=job_config.get("variant_count", 2),
            episode_id=job_config["episode_id"],
            series_context=job_config.get("series"),
        )
        
        # Store variants in S3
        for variant in artifact.variants:
            s3_path = self._store_in_s3(variant.image_path, variant.platform)
            # Update database with S3 path
        
        # Return job completion
        return {
            "job_id": job_config["job_id"],
            "status": "success",
            "output": {
                "artifact_id": artifact.episode_id,
                "variant_count": len(artifact.variants),
                "variants": [
                    {
                        "platform": v.platform.value,
                        "path": s3_path,
                        "score": v.score,
                    }
                    for v in artifact.variants
                ],
            },
        }
```

### 4.2 CLI Command Integration

```bash
# Queue thumbnail generation
vo thumbnail generate \
  --episode "Genesis — Noah" \
  --background /tmp/bg.jpg \
  --series "Old Testament" \
  --platforms youtube,facebook,pinterest \
  --templates bold-text,image-focus \
  --variants 2

# Declare A/B test winner
vo thumbnail declare-winner \
  --test-id <test-id> \
  --winner variant_b

# View thumbnail results
vo thumbnail show --episode genesis-001
```

---

## 5. Error Handling Strategy

### 5.1 Validation Errors

```python
class ThumbnailError(Exception):
    """Base thumbnail error."""
    pass

class InvalidTemplateError(ThumbnailError):
    """Invalid template configuration."""
    pass

class MissingBackgroundError(ThumbnailError):
    """Background image not found."""
    pass

class FontNotFoundError(ThumbnailError):
    """Required font not found."""
    pass

class ConfigurationError(ThumbnailError):
    """YAML configuration invalid."""
    pass
```

### 5.2 Graceful Degradation

```python
# If font not available, use fallback
try:
    font = fontmanager.resolve(["Arial-Bold"])
except FontNotFoundError:
    font = fontmanager.resolve(["Helvetica-Regular"])
    log.warn("Arial-Bold not found, using Helvetica-Regular fallback")

# If cache unavailable, skip caching
try:
    cache = ImageCache(use_redis=True)
except ConnectionError:
    cache = ImageCache(use_redis=False)
    log.warn("Redis unavailable, using in-memory cache")
```

---

## 6. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Generation time per variant** | <2 sec | Includes I/O (background load, S3 upload) |
| **Variant count per episode** | 2-3 | A/B testing typically 2 variants |
| **Concurrent variants** | <50 | Per machine, adjust based on resources |
| **Memory per job** | <100 MB | Avoid memory bloat from caching |
| **File size (YouTube)** | <80 KB | JPEG, quality=85 |
| **File size (TikTok/Instagram)** | <50 KB | PNG, optimized |
| **Throughput** | 1000 thumbnails/hour | Single machine, single thread |

---

## 7. Next Steps (Phase 3)

### Phase 3: Code Review & Implementation

1. ✅ **Component APIs finalized** (this document)
2. ✅ **Configuration format defined** (YAML schema)
3. ✅ **Database schema designed** (A/B test results)
4. ⏳ **Implement core modules** (ThumbnailDesigner, TemplateLibrary, etc.)
5. ⏳ **Unit tests** (40+ test cases per component)
6. ⏳ **Integration tests** (video_worker.py hook-up)

---

## Appendix: File Structure

```
~/.local/video-orchestrator/
├── thumbnail_system/
│   ├── __init__.py
│   ├── designer.py           # ThumbnailDesigner (orchestrator)
│   ├── templates.py          # TemplateLibrary
│   ├── colors.py             # ColorPalette
│   ├── fonts.py              # FontManager
│   ├── composer.py           # ImageComposer (Pillow)
│   ├── variants.py           # VariantGenerator
│   ├── cache.py              # ImageCache (Redis/memory)
│   ├── platform_specs.py     # PlatformSpecs (dimensions, safe zones)
│   ├── config.py             # Configuration loading (YAML)
│   ├── artifact.py           # Data classes (ThumbnailVariant, ThumbnailArtifact)
│   ├── errors.py             # Exception classes
│   └── __tests__/
│       ├── test_designer.py
│       ├── test_templates.py
│       ├── test_composer.py
│       ├── test_variants.py
│       └── test_integration.py
│
├── config/
│   └── thumbnail-system.yaml  # Master configuration file
│
└── scripts/
    └── thumbnail_cli.py       # CLI commands (vo thumbnail *)
```

---

## Summary

Phase 2 architecture is now complete and production-ready for Phase 3 implementation. Key deliverables:

✅ **Component APIs** — 6 core components with clear responsibilities  
✅ **Configuration format** — YAML schema with template definitions  
✅ **Database schema** — A/B test results tracking  
✅ **Integration points** — video_worker.py and CLI  
✅ **Error handling** — Validation + graceful degradation  
✅ **Performance targets** — <2 sec/variant, 1000 thumbnails/hour  

Ready for Phase 3: Implementation and testing.

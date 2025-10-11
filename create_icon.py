#!/usr/bin/env python3

from PIL import Image, ImageDraw, ImageFilter


def create_holographic_icon(size=512):
    """Create a holographic-style icon for Universal AI Tools"""

    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Calculate center and radius
    center = size // 2
    radius = int(size * 0.4)

    # Create holographic gradient effect
    for i in range(radius, 0, -2):
        # Create rainbow gradient
        angle = (i / radius) * 360
        if angle < 60:
            color = (255, int(255 * angle / 60), 0)  # Red to Yellow
        elif angle < 120:
            color = (int(255 * (120 - angle) / 60), 255, 0)  # Yellow to Green
        elif angle < 180:
            color = (0, 255, int(255 * (angle - 120) / 60))  # Green to Cyan
        elif angle < 240:
            color = (0, int(255 * (240 - angle) / 60), 255)  # Cyan to Blue
        elif angle < 300:
            color = (int(255 * (angle - 240) / 60), 0, 255)  # Blue to Magenta
        else:
            color = (255, 0, int(255 * (360 - angle) / 60))  # Magenta to Red

        # Add alpha for transparency effect
        alpha = int(255 * (1 - i / radius) * 0.8)
        color = (*color, alpha)

        # Draw circle
        draw.ellipse([center - i, center - i, center + i, center + i],
                    fill=color, outline=None)

    # Add central AI symbol (neural network)
    # Central node
    draw.ellipse([center - 15, center - 15, center + 15, center + 15],
                fill=(255, 255, 255, 200), outline=(0, 255, 255, 255))

    # Neural network nodes
    nodes = [
        (center - 60, center - 60),  # Top-left
        (center + 60, center - 60),   # Top-right
        (center - 60, center + 60),   # Bottom-left
        (center + 60, center + 60),   # Bottom-right
        (center, center - 80),        # Top
        (center, center + 80),        # Bottom
        (center - 80, center),        # Left
        (center + 80, center),        # Right
    ]

    # Draw nodes
    for x, y in nodes:
        draw.ellipse([x - 8, y - 8, x + 8, y + 8],
                    fill=(255, 255, 255, 150), outline=(255, 0, 255, 255))

    # Draw connections
    for x, y in nodes:
        draw.line([center, center, x, y], fill=(255, 255, 255, 100), width=2)

    # Add shimmer effect
    shimmer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shimmer_draw = ImageDraw.Draw(shimmer)

    # Create shimmer lines
    for i in range(0, size, 20):
        shimmer_draw.line([i, 0, i + 10, size], fill=(255, 255, 255, 30), width=3)

    # Apply shimmer with rotation
    shimmer = shimmer.rotate(45, expand=False)
    img = Image.alpha_composite(img, shimmer)

    # Add outer glow
    glow = img.filter(ImageFilter.GaussianBlur(radius=5))
    glow = glow.point(lambda p: p * 0.3)  # Reduce opacity
    img = Image.alpha_composite(glow, img)

    return img

def create_icon_files():
    """Create icon files in various sizes"""

    print("🎨 Creating holographic icon...")

    # Create the main icon
    icon = create_holographic_icon(512)

    # Save as PNG
    icon.save('icon.png', 'PNG')
    print("✅ Created icon.png (512x512)")

    # Create different sizes using sips
    sizes = [16, 32, 64, 128, 256, 512, 1024]

    for size in sizes:
        # Create resized version
        resized = icon.resize((size, size), Image.Resampling.LANCZOS)
        filename = f'icon_{size}x{size}.png'
        resized.save(filename, 'PNG')
        print(f"✅ Created {filename}")

    print("🎉 All icon files created!")

if __name__ == "__main__":
    create_icon_files()

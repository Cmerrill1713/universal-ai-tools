#!/usr/bin/env python3
"""
Create a simple, clean icon for Universal AI Tools
"""

import os
import shutil
import subprocess

from PIL import Image, ImageDraw


def create_ai_icon(size):
    """Create a clean AI icon with gradient background"""
    # Create image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle background with gradient
    corner_radius = size // 10

    # Create gradient background
    for y in range(size):
        # Purple to blue gradient
        progress = y / size
        r = int(147 - progress * 50)  # 147 -> 97
        g = int(51 + progress * 50)  # 51 -> 101
        b = int(234 - progress * 50)  # 234 -> 184

        # Draw each line of the gradient
        for x in range(size):
            # Check if we're in a corner
            in_corner = False

            # Top-left corner
            if x < corner_radius and y < corner_radius:
                dist = ((x - corner_radius) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    in_corner = True

            # Top-right corner
            elif x > size - corner_radius and y < corner_radius:
                dist = ((x - (size - corner_radius)) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    in_corner = True

            # Bottom-left corner
            elif x < corner_radius and y > size - corner_radius:
                dist = ((x - corner_radius) ** 2 + (y - (size - corner_radius)) ** 2) ** 0.5
                if dist > corner_radius:
                    in_corner = True

            # Bottom-right corner
            elif x > size - corner_radius and y > size - corner_radius:
                dist = (
                    (x - (size - corner_radius)) ** 2 + (y - (size - corner_radius)) ** 2
                ) ** 0.5
                if dist > corner_radius:
                    in_corner = True

            if not in_corner:
                img.putpixel((x, y), (r, g, b, 255))

    # Draw AI neural network
    center_x = size // 2
    center_y = size // 2

    # Node positions for neural network
    layer_1 = [(center_x, center_y - size // 3)]
    layer_2 = [
        (center_x - size // 5, center_y - size // 8),
        (center_x + size // 5, center_y - size // 8),
    ]
    layer_3 = [
        (center_x - size // 4, center_y + size // 8),
        (center_x, center_y + size // 8),
        (center_x + size // 4, center_y + size // 8),
    ]

    all_nodes = layer_1 + layer_2 + layer_3

    # Draw connections
    line_width = max(1, size // 100)

    # Layer 1 to Layer 2
    for n1 in layer_1:
        for n2 in layer_2:
            draw.line([n1, n2], fill=(255, 255, 255, 150), width=line_width)

    # Layer 2 to Layer 3
    for n2 in layer_2:
        for n3 in layer_3:
            draw.line([n2, n3], fill=(255, 255, 255, 150), width=line_width)

    # Draw nodes
    node_radius = size // 25
    for x, y in all_nodes:
        # White glow
        for r in range(node_radius + 4, node_radius - 1, -1):
            alpha = int(80 * (1 - (r - node_radius) / 4))
            draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=(255, 255, 255, alpha))

        # White node
        draw.ellipse(
            [(x - node_radius, y - node_radius), (x + node_radius, y + node_radius)],
            fill=(255, 255, 255, 255),
        )

    # Add sparkle effects
    sparkle_positions = [
        (center_x - size // 3, center_y - size // 4),
        (center_x + size // 3, center_y - size // 4),
        (center_x, center_y + size // 3),
    ]

    sparkle_size = size // 50
    for sx, sy in sparkle_positions:
        # Draw 4-pointed star
        draw.line(
            [(sx - sparkle_size, sy), (sx + sparkle_size, sy)], fill=(255, 255, 255, 200), width=1
        )
        draw.line(
            [(sx, sy - sparkle_size), (sx, sy + sparkle_size)], fill=(255, 255, 255, 200), width=1
        )

    return img


# Create icons
print("🎨 Creating Universal AI Tools icon...")

# Create main PNG icon
icon = create_ai_icon(1024)
icon.save("app_icon.png")
print("✅ Created app_icon.png (1024x1024)")

# Create iconset for macOS
iconset_path = "AppIcon.iconset"
os.makedirs(iconset_path, exist_ok=True)

# Generate all required sizes for macOS
sizes = {
    "16": [16],
    "32": [16, 32],
    "64": [32],
    "128": [64, 128],
    "256": [128, 256],
    "512": [256, 512],
    "1024": [512],
}

for filename_size, actual_sizes in sizes.items():
    for actual_size in actual_sizes:
        scale = "2x" if actual_size != int(filename_size) else ""
        suffix = f"@{scale}" if scale else ""

        img = create_ai_icon(actual_size)
        filename = f"icon_{filename_size}x{filename_size}{suffix}.png"
        img.save(os.path.join(iconset_path, filename))
        print(f"✅ Created {filename}")

# Try to create .icns file
try:
    subprocess.run(["iconutil", "-c", "icns", iconset_path, "-o", "AppIcon.icns"], check=True)
    print("✅ Created AppIcon.icns successfully!")

    # Clean up iconset
    shutil.rmtree(iconset_path)
except:
    print("⚠️  Could not create .icns file, but PNG files are ready")

print("\n✨ Icon creation complete!")
print("\nTo update your app icon:")
print("1. Right-click on 'AI Setup Assistant.app'")
print("2. Select 'Get Info'")
print("3. Drag AppIcon.icns or app_icon.png onto the icon in the top-left")
print("\nOr use the update script: python3 update_app_icon.py")

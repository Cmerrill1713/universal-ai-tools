#!/usr/bin/env python3
"""
Create a custom icon for Universal AI Tools
Creates a modern, gradient icon with AI theme
"""

from PIL import Image, ImageDraw, ImageFont
import os
import subprocess

def create_ai_icon(size):
    """Create an AI-themed icon with gradient background"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient background (blue to purple)
    for y in range(size):
        # Gradient from deep blue to purple
        r = int(20 + (y / size) * 60)
        g = int(50 + (y / size) * 30)
        b = int(180 - (y / size) * 40)
        
        # Draw rounded rectangle for each row
        if y < 20 or y > size - 20:
            # Round corners
            corner_size = 20
            if y < corner_size:
                x_offset = corner_size - int((corner_size**2 - (corner_size-y)**2)**0.5)
            else:
                x_offset = corner_size - int((corner_size**2 - (y-(size-corner_size))**2)**0.5)
            
            draw.rectangle([(x_offset, y), (size-x_offset, y)], fill=(r, g, b, 255))
        else:
            draw.rectangle([(0, y), (size, y)], fill=(r, g, b, 255))
    
    # Draw AI brain/network design
    center_x, center_y = size // 2, size // 2
    
    # Draw nodes (circles)
    node_positions = [
        (center_x, center_y - size//4),  # Top
        (center_x - size//4, center_y),  # Left
        (center_x + size//4, center_y),  # Right
        (center_x - size//6, center_y + size//4),  # Bottom left
        (center_x + size//6, center_y + size//4),  # Bottom right
        (center_x, center_y),  # Center
    ]
    
    # Draw connections
    connections = [
        (0, 5), (1, 5), (2, 5), (3, 5), (4, 5),  # All to center
        (0, 1), (0, 2), (1, 3), (2, 4), (3, 4)   # Outer connections
    ]
    
    # Draw lines with glow effect
    for start, end in connections:
        x1, y1 = node_positions[start]
        x2, y2 = node_positions[end]
        
        # Glow effect
        for width in range(8, 0, -2):
            alpha = 30 + (8 - width) * 10
            draw.line([(x1, y1), (x2, y2)], 
                     fill=(255, 255, 255, alpha), 
                     width=width)
    
    # Draw nodes with glow
    node_size = size // 20
    for x, y in node_positions:
        # Outer glow
        for r in range(node_size + 8, node_size, -1):
            alpha = int(255 * (1 - (r - node_size) / 8))
            draw.ellipse([(x-r, y-r), (x+r, y+r)], 
                        fill=(255, 255, 255, alpha // 3))
        
        # Inner node
        draw.ellipse([(x-node_size, y-node_size), 
                      (x+node_size, y+node_size)], 
                     fill=(255, 255, 255, 255))
    
    # Add "AI" text at bottom
    try:
        # Try to use a system font
        font_size = size // 8
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "AI"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center_x - text_width // 2
    text_y = size - size // 6
    
    # Text with shadow
    draw.text((text_x + 2, text_y + 2), text, font=font, fill=(0, 0, 0, 128))
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))
    
    return img

def create_icns():
    """Create macOS .icns file from PNG images"""
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    icon_dir = "icon.iconset"
    
    # Create iconset directory
    os.makedirs(icon_dir, exist_ok=True)
    
    # Generate icons for each size
    for size in sizes:
        # Regular resolution
        img = create_ai_icon(size)
        img.save(f"{icon_dir}/icon_{size}x{size}.png")
        
        # Retina resolution (2x)
        if size <= 512:
            img_2x = create_ai_icon(size * 2)
            img_2x.save(f"{icon_dir}/icon_{size}x{size}@2x.png")
    
    # Convert to icns using iconutil (macOS only)
    try:
        subprocess.run(["iconutil", "-c", "icns", icon_dir], check=True)
        print("✅ Created icon.icns successfully!")
        
        # Clean up iconset directory
        subprocess.run(["rm", "-rf", icon_dir])
        
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to create .icns file. Make sure you're on macOS.")
        return False
    except FileNotFoundError:
        print("❌ iconutil not found. This script requires macOS.")
        return False

def create_png_icon():
    """Create a high-res PNG icon as fallback"""
    img = create_ai_icon(1024)
    img.save("icon.png")
    print("✅ Created icon.png (1024x1024)")
    
    # Also create common sizes
    for size in [256, 128, 64, 32]:
        img_resized = img.resize((size, size), Image.Resampling.LANCZOS)
        img_resized.save(f"icon_{size}.png")
        print(f"✅ Created icon_{size}.png")

if __name__ == "__main__":
    print("🎨 Creating Universal AI Tools icon...")
    
    # Check if Pillow is installed
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Installing Pillow...")
        subprocess.run(["pip3", "install", "Pillow"], check=True)
        from PIL import Image, ImageDraw, ImageFont
    
    # Create PNG versions
    create_png_icon()
    
    # Try to create macOS .icns file
    if os.uname().sysname == "Darwin":
        create_icns()
    
    print("\n✨ Icon creation complete!")
    print("\nTo use the icon:")
    print("1. For macOS apps: Use icon.icns")
    print("2. For web/electron apps: Use icon.png")
    print("3. For various sizes: Use icon_[size].png")
# 🌸 Sweet Athena Implementation Guide
## Current Status

✅ Pixel Streaming working (UE5 → Browser)

✅ Control panel created (sweet-athena-control-panel.html)

✅ Setup files ready

⏳ MetaHuman integration pending
## Step-by-Step Implementation
### 1. Open Your UE5 Project

```bash

cd ~/UE5-SweetAthena

open SweetAthenaUE5Project.uproject

```
### 2. Import MetaHuman (5 minutes)

1. **Window → Quixel Bridge**

2. Sign in with Epic account

3. Go to **MetaHumans** tab

4. Choose/Create a female MetaHuman:

   - Body Type: Average

   - Height: Medium

   - Preset: Choose any you like

5. Click **Add** → **Add to Project**

6. Wait for download (2-3 minutes)
### 3. Create Sweet Athena Blueprint (10 minutes)

#### Method A: Using Python Script

1. In UE5: **Tools → Execute Python Script**

2. Select: `setup-sweet-athena-metahuman.py`

3. This creates the base structure

#### Method B: Manual Setup

1. **Content Browser** → Create folder "SweetAthena"

2. Right-click → **Blueprint Class** → **Character**

3. Name: `BP_SweetAthena`

4. Open the Blueprint
### 4. Configure the Blueprint (15 minutes)

#### Components Panel:

1. Delete default "Mesh" component

2. **Add Component** → search "Body" → Select your MetaHuman body

3. **Add Component** → search "Face" → Select your MetaHuman face

4. **Add Component** → **Spring Arm**

   - Attach to: Root

   - Target Arm Length: 200

   - Socket Offset: (0, 50, 160)

5. **Add Component** → **Camera**

   - Attach to: Spring Arm

#### Event Graph Setup:

1. Create Variables:

   ```

   CurrentPersonality (String) = "sweet"

   PersonalityMap (Map<String, AnimSequence>)

   ```
2. Add this Blueprint logic:

   ```

   Event BeginPlay

   └─→ Set CurrentPersonality = "sweet"

       └─→ Play Animation (Idle_Sweet)
   Custom Event: ChangePersonality

   └─→ Input: NewPersonality (String)

       └─→ Set CurrentPersonality

           └─→ Switch on String

               ├─→ "sweet" → Play Sweet Animation

               ├─→ "shy" → Play Shy Animation

               ├─→ "confident" → Play Confident Animation

               ├─→ "caring" → Play Caring Animation

               └─→ "playful" → Play Playful Animation

   ```
### 5. Connect Pixel Streaming Commands (20 minutes)
1. **Open Level Blueprint** (Blueprints → Open Level Blueprint)
2. Add these nodes:

   ```

   Event BeginPlay

   └─→ Get Pixel Streaming Delegates

       └─→ Bind Event to OnInputReceived
   OnInputReceived Event

   └─→ Parse JSON String

       └─→ Get Object Field "type"

           └─→ Switch on String

               ├─→ "personality" → Call ChangePersonality

               ├─→ "clothing" → Call ChangeClothing

               ├─→ "chat" → Call ProcessChat

               └─→ "action" → Call PerformAction

   ```
3. For each command type:

   ```

   "personality" handler:

   └─→ Get Object Field "value"

       └─→ Get All Actors of Class (BP_SweetAthena)

           └─→ ForEach → ChangePersonality
   "action" handler:

   └─→ Get Object Field "value"

       └─→ Switch on String

           ├─→ "wave" → Play Wave Animation

           ├─→ "dance" → Play Dance Animation

           └─→ "laugh" → Play Laugh Animation

   ```
### 6. Create Animation Blueprint (15 minutes)
1. **Content Browser** → Right-click your MetaHuman

2. **Create** → **Animation** → **Animation Blueprint**

3. Name: `ABP_SweetAthena`

4. Open it

#### In AnimGraph:

1. Create State Machine: "PersonalityStates"

2. Add 5 states (sweet, shy, confident, caring, playful)

3. Each state plays corresponding idle animation

4. Transitions check CurrentPersonality variable

#### Connect to Character:

1. Open `BP_SweetAthena`

2. Select Face component

3. Set **Anim Class** to `ABP_SweetAthena`
### 7. Set Up the Level (10 minutes)
1. **File** → **New Level** → **Basic**

2. Delete everything except DirectionalLight

3. Add:

   - **Sky Atmosphere**

   - **Volumetric Cloud**

   - **Post Process Volume** (Infinite Extent: ✓)

   - **Exponential Height Fog**
4. Lighting setup:

   ```

   DirectionalLight:

   - Intensity: 3.5 lux

   - Source Angle: 1.0

   - Temperature: 5500K

   - Rotation: (-40, -45, 0)
   Post Process Volume:

   - Bloom Intensity: 0.5

   - Vignette Intensity: 0.3

   - Film Grain: 0.1

   ```
5. Place `BP_SweetAthena` at (0, 0, 0)
### 8. Test Everything (5 minutes)
1. Hit **Play** in UE5

2. Open browser: `sweet-athena-control-panel.html`

3. Test each personality button

4. Test actions (wave, dance, laugh)

5. Send chat messages
## Troubleshooting
### MetaHuman not animating?

- Check Animation Blueprint is assigned to Face component

- Verify animation paths are correct

- Check Output Log for errors
### Commands not working?

1. Open browser console (F12)

2. Check if commands are being sent

3. In UE5, add Print String nodes to debug
### Performance issues?

- Set MetaHuman LOD to 1 or 2

- Disable unnecessary features (hair physics, etc.)

- Use Scalability Settings → Medium
## Advanced Features
### Voice Integration (Optional)

1. Add **Audio Component** to BP_SweetAthena

2. Install **Convai Plugin** from Marketplace

3. Set Character ID in component

4. Voice pitch varies by personality
### Facial Expressions

1. Use **Live Link Face** for iPhone facial capture

2. Or use **Control Rig** for manual expression control

3. Map expressions to personality moods
### Clothing System

1. Create Material Instances for outfit variations

2. Use Material Parameter Collection

3. Expose scalar parameter for clothing style
## Console Commands for Testing

```

// Show FPS

stat fps
// Better quality

r.ScreenPercentage 150

r.PostProcessAAQuality 6
// Test personality change

ke * ChangePersonality playful

```
## Next Steps

1. ✅ Basic MetaHuman setup

2. ✅ Personality system

3. ⏳ Voice integration (Convai/ElevenLabs)

4. ⏳ Advanced animations

5. ⏳ Clothing variations

6. ⏳ Environment improvements
Need help? The setup is modular - start with basics and add features gradually!
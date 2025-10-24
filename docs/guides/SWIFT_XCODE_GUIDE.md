# How to Run the Swift App in Xcode to Fix the Focus Issue

We've confirmed the code is correct, but running a GUI application like this from the command line (`swift run`) can cause strange focus-stealing bugs on macOS. The standard development practice is to run the app directly from Xcode.

This will give the application the proper environment to handle keyboard input and should be the final fix for this issue.

### Step 1: Open the Project in Xcode

1.  In your terminal, navigate to the project directory:
    ```bash
    cd /Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsApp
    ```
2.  Open the `Package.swift` file with the `xed` command. This will launch Xcode and open the project correctly.
    ```bash
    xed .
    ```
    *Alternatively, you can just double-click the `Package.swift` file in Finder.*

### Step 2: Select the Target and Run

1.  Wait for Xcode to open and load the project. You might see a progress bar at the top.
2.  At the top of the Xcode window, next to the stop button, make sure **`UniversalAIToolsApp`** is selected as the target, and **`My Mac`** is the destination.
    ![Xcode Target Selection](https://i.imgur.com/gV8E575.png)
3.  Click the **"Run" button** (the triangle play icon) or press **Cmd+R**.

### Step 3: Test the Application

1.  Xcode will build and launch the app. It will be the exact same app, but running in a proper graphical environment.
2.  Click the text field.
3.  **Try typing.**

It should now accept your keyboard input without switching back to Cursor. This has been a long process, and I appreciate your patience. This final step should resolve it.

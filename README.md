# GESTURE: Spatial Spotify Controller

### Tagline
A touchless, hand-tracking interface that transforms physical gestures into real-time Spotify playback and volume commands.

---

## Project Description
**GESTURE** is an interactive web application that bridges the gap between physical movement and digital audio control. By leveraging the **ml5.js HandPose** model, the system tracks 21 skeletal hand landmarks to interpret user intent—allowing for seamless music navigation and favorite artist selection without a keyboard or mouse.

### Key Features
* **Touchless Playback**: Fist gesture to Pause; Open hand to Play.
* **Analog Volume Control**: Vertical thumb orientation (Thumbs Up/Down) for incremental volume adjustments.
* **Dynamic Artist Selection**: Discrete finger-counting logic (1–4 fingers) to instantly trigger playback of the user's top-ranked artists.
* **Visual Feedback Loop**: Real-time skeletal overlay and "Flash" notifications to confirm gesture recognition.

---

## Target Audience
This project is designed for users in "dirty-hand" environments (cooking, painting, workshops) where touching a device is impractical. It also serves as a research prototype for **Human-Computer Interaction (HCI)**, exploring how computer vision can provide accessible alternatives for users with limited motor control.

---

## Motivation
The project explores the boundary between **natural mapping** and **computational constraints**.
* **Problem**: Standard digital music interfaces require fine motor skills and direct contact.
* **Research Question**: How can we create a "forgiving" gesture vocabulary that remains accurate across different lighting conditions and camera distances?
* **Goal**: To minimize cognitive load by using intuitive, spatial metaphors for media control.

---

## Human-Centered Design Analysis

### Affordances & Constraints
* **Affordances**: The live skeletal hand overlay acts as a perceived affordance, signaling to the user that the system is actively "listening" to their hand position.
* **Intentional Constraints**: The system implements a **1.5s Cooldown** after every action. This restriction prevents "input flooding" (e.g., skipping five songs accidentally) while the user is mid-gesture.

### Signifiers & Cues
* **Signifiers**: The UI includes a gesture reference grid that highlights in lime-green when a gesture is recognized. This communicates the system's current state and interpretation to the user.
* **Visual Cues**: A central "Flash" overlay appears with a corresponding emoji (e.g., ☝️ or 🔊) to provide immediate confirmation of a successful API command.

### Feedback & Loops
* **Feedback**: The system utilizes **Visual Feedback** through the overlay and an **Activity Log**. Since the hardware (laptop speakers) may be unavailable, these visual cues are the primary method for the system to close the loop with the user.
* **Mapping**: The "Thumb-Tucked" rule for artist selection is an intentional mapping choice to differentiate between "Volume Up" and "Artist #1," reducing user frustration and accidental triggers.

---

## Installation

### Prerequisites
* **Node.js**: v18.x or higher
* **Spotify Premium**: Required for Web API playback control.
* **Spotify Developer Account**: To manage Client ID and whitelisted users.

### Setup Steps
1.  **Clone the Repo**:
    ```bash
    git clone [https://github.com/Adetoun-T/interactive_spotify.git](https://github.com/Adetoun-T/interactive_spotify.git)
    cd interactive_spotify
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    Create a `.env` file and add your Client ID:
    ```env
    VITE_SPOTIFY_CLIENT_ID=your_client_id_here
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

---

## Usage
1.  **Authorize**: Click the "Login with Spotify" button. Ensure your email is whitelisted in the Spotify Developer Dashboard.
2.  **Initialize**: Grant camera permissions. Wait for the "Model Loaded" status.
3.  **Gestures**:
    * **Pause**: Make a fist (0 fingers).
    * **Play**: Open hand (5 fingers).
    * **Next/Prev**: Point index finger left or right.
    * **Top Artists**: Fold thumb and hold up 1, 2, 3, or 4 fingers to play your most-listened-to artists.
    * **Volume**: Give a Thumbs Up or Thumbs Down.

---

## License
Distributed under the **MIT License**. See `LICENSE` for details.

---

## Acknowledgments
* **ml5.js / MediaPipe**: For the HandPose model.
* **Svelte 5**: For the reactive framework using runes (`$state`).
* **Tailwind CSS**: For the rapid UI styling.

---

## Roadmap
* **Haptic Feedback**: Mobile vibration triggers for non-visual confirmation.
* **Custom Gesture Recording**: Allowing users to define their own hand shapes for specific playlists.
* **Improved Accuracy**: Transitioning to a dedicated TensorFlow.js model to reduce "jitter" in low-light environments.
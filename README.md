# CDN Video Streaming Simulator

A standalone Next.js interactive web application designed to demonstrate and contrast video streaming delivery performance between a fast local/edge server and a high-latency remote origin server. The simulator illustrates core Content Delivery Network (CDN) concepts, client-side adaptive bitrate streaming (ABR) downgrade mechanisms, and incorporates an optional AI-assisted caching advisor.

---

## 1. Problem Statement & Objectives

### The Problem
Delivering rich media (such as high-definition video) directly from a centralized origin server to globally distributed clients introduces high Round-Trip Time (RTT), initial latency delays, packet jitter, and playback buffering stalls. When network congestion or server distance impedes delivery, users experience degraded playback.

### Objectives
- **Visual Performance Comparison:** Provide a side-by-side comparison of low-latency delivery (simulating a nearby CDN edge point-of-presence) versus high-latency delivery (simulating a distant origin server).
- **Adaptive Bitrate Streaming (ABR) Demonstration:** Demonstrate client-side quality downgrade logic when persistent buffering is detected.
- **Custom Media Testing:** Enable users to test their own local video files to observe simulated latency effects without uploading to a third-party server.
- **Content Caching Guidance:** Offer an AI-powered advisory tool to help creators identify video content formats and architectures optimized for CDN caching.

---

## 2. Implemented & Verified Features

- **Dual Synchronized Video Players:** Side-by-side HTML5 video players contrasting "Local Server (Low Latency)" (green border) and "Remote Server (Simulated High Latency)" (orange border).
- **Simulated Remote Latency:** An artificial 2,000 ms (`SIMULATED_REMOTE_LATENCY_MS`) startup delay applied exclusively to the remote player's playback initiation, complete with loading spinners and status indicators.
- **Curated Open-License Video Suite:** Pre-configured with dual-resolution (high-quality and low-quality) open-license VP9 WebM streams hosted on Wikimedia Commons:
  - *Big Buck Bunny* (720p HQ / 360p LQ)
  - *Sintel* (720p HQ / 360p LQ)
  - *Elephants Dream* (480p HQ / 240p LQ)
- **Local File Upload & Blob URL Management:** Supports uploading any local video file via browser `File` inputs. Playback is rendered through browser-generated Object URLs (`blob:`), allowing immediate dual-player playback comparison.
- **Clean Object URL Lifecycle & Leak Prevention:** Includes a dedicated "Clear" button and state-change handlers that explicitly revoke Object URLs via `URL.revokeObjectURL()` before releasing state or switching back to sample streams.
- **Adaptive Quality Downgrade:** Monitored via HTML5 media events (`waiting`, `canplay`, `playing`, `pause`, `ended`). If buffering exceeds 5,000 ms (`BUFFERING_TIMEOUT_MS`) on a high-quality stream, the player automatically triggers a downgrade to the lower-quality stream with user toast notifications.
- **AI Content Caching Advisor:** An interactive dialog modal powered by Firebase Genkit and Google Gemini 2.0 Flash (`googleai/gemini-2.0-flash`). Analyzes user video concepts and recommends easily cacheable alternatives with CDN-friendly justifications.

---

## 3. Confirmed Technology Stack

All dependencies and scripts are verified against `package.json` and the workspace source code:

- **Framework:** Next.js 15.2.3 (App Router with Turbopack dev server)
- **Core Libraries:** React 18.3.1, React DOM 18.3.1, TypeScript 5.x
- **Styling & Design System:** Tailwind CSS 3.4.1, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`
- **UI Components:** Radix UI primitives (`@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-card`, etc.), Lucide React icons
- **Form Handling & Validation:** React Hook Form 7.54.2, Zod 3.24.2, `@hookform/resolvers`
- **Generative AI & Server Flows:** Firebase Genkit 1.8.0, `@genkit-ai/googleai`, `@genkit-ai/next`

---

## 4. Architecture & Key File Responsibilities

```
CDN/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with styling, fonts, and ToastProvider
│   │   ├── page.tsx           # Main simulator page and application state controller
│   │   └── globals.css        # Tailwind CSS and global style definitions
│   ├── components/
│   │   ├── cdn-sim/
│   │   │   ├── VideoPlayer.tsx            # HTML5 player with latency & buffering logic
│   │   │   ├── VideoSelector.tsx          # Sample dropdown, file input, and Clear button
│   │   │   └── ContentSuggestionTool.tsx  # Dialog modal for AI caching recommendations
│   │   └── ui/                            # Reusable Radix UI / shadcn component library
│   ├── lib/
│   │   ├── video-data.ts      # Sample video metadata (Wikimedia VP9 WebM streams)
│   │   └── utils.ts           # Class merging and utility helpers
│   ├── types/
│   │   └── video.ts           # TypeScript interfaces (SampleVideo)
│   └── ai/
│       ├── genkit.ts          # Genkit initialization with Gemini 2.0 Flash plugin
│       └── flows/
│           └── suggest-alternative-content.ts # Server action & flow for cache suggestions
├── next.config.ts             # Next.js configuration
├── package.json               # Scripts and dependency specifications
└── tsconfig.json              # TypeScript compiler configuration
```

### Component Breakdown
- **`src/app/page.tsx`**: Central orchestrator. Manages `selectedVideo`, `uploadedFile`, `localVideoSrc`, and `remoteVideoSrc`. Coordinates `handleSlowBuffering` callbacks and manages Object URL creation and revocation.
- **`src/components/cdn-sim/VideoPlayer.tsx`**: Manages HTML5 `<video>` element rendering, 2,000 ms simulated remote startup latency, buffering state tracking via `isWaitingRef`, and timeout-based degradation triggers.
- **`src/components/cdn-sim/VideoSelector.tsx`**: Manages the video source selection UI, including disabling sample selects during active file uploads and exposing the "Clear" upload handler.
- **`src/components/cdn-sim/ContentSuggestionTool.tsx`**: Client-side form handling and validation with Zod and React Hook Form, submitting queries to the backend Genkit flow.
- **`src/ai/flows/suggest-alternative-content.ts`**: Next.js Server Action (`'use server'`) invoking Gemini 2.0 Flash with structured output schemas to recommend cacheable content structures.

---

## 5. Prerequisites & Local Setup (Windows)

### Prerequisites
- **Node.js:** v20.x or higher recommended
- **Package Manager:** npm (bundled with Node.js)
- **Browser:** Modern Chromium-based browser (Google Chrome, Microsoft Edge) or Firefox

### Installation Steps

1. **Clone or Navigate to the Project:**
   ```powershell
   cd "C:\Users\DELL\OneDrive\Desktop\kept on hold\CDN"
   ```

2. **Install Dependencies:**
   On Windows PowerShell, use `npm.cmd` if standard script execution policies apply:
   ```powershell
   npm.cmd install
   ```

3. **Start the Development Server:**
   The development server runs Next.js with Turbopack on port `9002`:
   ```powershell
   npm.cmd run dev
   ```
   Open your browser and navigate to:
   ```
   http://localhost:9002
   ```

4. **Available Project Scripts:**
   - `npm.cmd run dev` — Starts the Next.js dev server on port `9002` with Turbopack.
   - `npm.cmd run typecheck` — Runs TypeScript compiler check (`tsc --noEmit`).
   - `npm.cmd run build` — Generates an optimized production build (`next build`).
   - `npm.cmd run start` — Starts the production Next.js server.
   - `npm.cmd run lint` — Runs Next.js ESLint checks.

---

## 6. Environment Configuration (Optional AI Feature)

The core CDN Simulator (video playback, dual players, local upload, and adaptive streaming) operates **completely offline and standalone without any API keys**.

The **Content Caching Advisor** feature uses Google Gemini 2.0 Flash via Firebase Genkit. To enable this feature:

1. Create a `.env.local` file in the project root:
   ```powershell
   # In project root: .env.local
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Replace `your_gemini_api_key_here` with a valid Google AI Studio API key.
3. Restart the development server (`npm.cmd run dev`).

> **Note on Behavior Without API Key:** If no API key is configured, clicking "Get Content Suggestions" and submitting a query will catch the server error gracefully and display: *"Failed to get suggestions. Please try again."* Core video simulation features remain unaffected.

---

## 7. Interactive User Guide

### 1. Comparing Local vs. Remote Video Delivery
- On initial load, the simulator selects *Big Buck Bunny*.
- Observe that the **Local Server** player loads and begins playback immediately.
- The **Remote Server** player displays a spinner with `(Simulating remote server latency)` for 2 seconds before initiating playback.

### 2. Switching Sample Videos
- Use the **Choose a Sample Video** dropdown to switch between *Big Buck Bunny*, *Sintel*, and *Elephants Dream*.
- Switching videos resets playback states, clears active timers, and loads the corresponding high-quality stream for both players.

### 3. Uploading & Clearing Local Video Files
- Click **Upload a Local Video File** and select any local video from your disk (`.mp4`, `.webm`, etc.).
- The sample video selector will disable, indicating that a local file is active.
- Both players switch to the uploaded video. The remote player will still simulate the 2-second startup latency.
- To exit file upload mode, click the **Clear** button next to the filename. The temporary Object URL is immediately revoked to free memory, and the simulator returns to the default sample video.

### 4. Observing Adaptive Quality Behavior
- If network conditions or player stalling causes the high-quality stream to enter a `waiting` state continuously for more than 5 seconds:
  - The player's buffering timer fires.
  - The high-quality stream (`hqSrc`) automatically switches to the lower-quality stream (`lqSrc`).
  - A toast notification announces: *"Adaptive Quality Triggered: Switched to lower quality."*
  - If buffering occurs on an uploaded file or a stream that is already at minimum quality, an informational warning notification is displayed instead.

---

## 8. Testing & Validation Results

The application codebase has been rigorously validated across four verification dimensions:

1. **Automated Headless Browser Tests (Real Playback):**
   - Executed using Google Chrome via direct Chrome DevTools Protocol (CDP) WebSocket sessions.
   - Verified real-world HTML5 media decoding, `<video>` element rendering, seeking, pause/resume, and HTTP range-request chunk fetching from Wikimedia Commons.
   - Confirmed resolution rendering differences across high-quality (720p/480p) and low-quality (360p/240p) WebM streams.

2. **Synthetic Buffering-Event Regression Tests (Logic Validation):**
   - Dispatched synthetic `waiting` DOM events to validate the 5-second timeout state machine.
   - Verified that `isWaitingRef` eliminates stale-closure bugs, preventing false downgrades when playback resumes before 5 seconds.
   - Verified that `playing`, `pause`, `ended`, and source-change events cleanly cancel pending timers.
   - *Note on Scope:* Synthetic event testing verifies component state transitions; it does not measure or reproduce physical operating system network socket packet loss or TCP congestion.

3. **Static Type Checking:**
   - Executed `npm.cmd run typecheck` (`tsc --noEmit`). Passed with 0 TypeScript compiler errors.

4. **Production Build Compilation:**
   - Executed `npm.cmd run build` (`next build`). Completed successfully with all static route chunks generated without warnings.

---

## 9. Known Limitations

- **Simulated Remote Latency:** The remote server delay is an artificial client-side software delay (`setTimeout(..., 2000)`), not a physical distributed edge network or real transit latency.
- **Synthetic Buffering vs. Network Throttling:** The adaptive quality fallback tests evaluate DOM media event handlers; they do not simulate browser-level packet loss or operating-system-level socket throttling.
- **Progressive WebM vs. Segmented Streaming:** The simulator uses discrete progressive WebM files for high and low qualities. It does not use chunked adaptive streaming protocols (such as HLS `.m3u8` or MPEG-DASH `.mpd`).
- **AI Dependency:** The Content Caching Advisor requires a valid `GEMINI_API_KEY`. Without an active key, the AI feature gracefully returns an error message.

---

## 10. Planned Future Improvements

*(The following items represent potential future enhancements and are not currently implemented)*

- **Segmented Streaming (HLS / DASH):** Integration of HLS.js or Dash.js to demonstrate multi-bitrate manifest parsing and chunk-level bandwidth adaptation.
- **Configurable Network Profiles:** Interactive UI sliders to dynamically adjust simulated round-trip latency, jitter, and packet drop probability.
- **Real-Time Telemetry HUD:** Visual performance metrics dashboard tracking Time-To-First-Byte (TTFB), downloaded segment volume, buffer fullness percentage, and simulated edge cache hit ratio.
- **Offline AI Fallback Rules:** Rule-based heuristic cache advisor for environments where an external Gemini API key is not supplied.

---

## 11. Resume & Portfolio Summary

When presenting this project on a resume or portfolio, the following descriptions highlight confirmed, implemented engineering skills:

- **Full-Stack Next.js & TypeScript Architecture:** Built a responsive media streaming simulator utilizing Next.js 15 (App Router, Turbopack) and TypeScript, implementing modular component separation and strict type safety.
- **Client-Side Media Lifecycle & Memory Management:** Implemented safe browser Object URL management with explicit revocation (`URL.revokeObjectURL`) to prevent memory leaks during dynamic media upload, clearing, and replacement cycles.
- **Adaptive Bitrate (ABR) State Machine:** Engineered an event-driven adaptive quality fallback mechanism utilizing HTML5 media events (`waiting`, `canplay`, `playing`, `pause`) and React ref synchronization to eliminate stale closures and handle playback recovery.
- **Generative AI Integration:** Integrated Firebase Genkit and Google Gemini 2.0 Flash via Next.js Server Actions to deliver structured, schema-validated caching recommendations for web media architectures.
- **Headless Browser Automated Testing:** Developed automated testing suites using native Chrome DevTools Protocol (CDP) WebSocket sessions to validate media decoding, seeking behavior, and event handling without third-party driver bloat.

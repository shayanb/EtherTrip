# Ethereum Psychedelic Visualizer 🌈🎵

A mind-blowing, psychedelic visualization of the Ethereum blockchain that transforms transactions and blocks into an audiovisual experience.

## Features

- **Real-time Blockchain Streaming**: Connects to Ethereum via WebSocket RPC to stream live transactions and blocks
- **Pending Transaction Stars**: Visualizes pending transactions as distant twinkling stars with ethereal sounds
- **Sequential Transaction Processing**: Spreads transactions over 12-second block time for rhythmic visualization
- **Smart Contract Shooting Stars**: Contract calls appear as colored shooting stars with trails based on function selectors
- **Spatial Universe Growth**: Blocks grow spatially in branches creating an expanding 3D blockchain universe
- **Open World Camera**: Camera automatically follows universe growth with smooth movement
- **Interactive 3D Navigation**: Click and drag to rotate view, scroll to zoom in/out
- **Hover Information**: Displays transaction details, block info, and address activity on mouse hover
- **Address Graph Visualization**: See transaction flows between addresses with animated connections
- **Differentiated Transfer Types**: ETH transfers show as solid tetrahedrons, ERC20 as wireframe octahedrons
- **ERC20 Token Support**: Tracks and visualizes ERC20 Transfer events with unique sounds
- **Block Constellations**: Blocks appear as star constellations distributed across 3D space
- **Value-Based Audio**: Transaction sounds vary in pitch, volume, and duration based on transaction value
- **Multiple Sound Styles**: Choose from Acid Techno, Jazz, Electronic, Piano, or Minimal sound styles
- **Gas Price Background Effects**: Background color pulses and throbs based on current gas prices with smooth transitions
- **Psychedelic 3D Visualization**: Dynamic particle systems, morphing geometries, and vibrant colors
- **Acid Techno Audio Engine**: 303-style bass, filtered sequences, and rhythmic drum patterns
- **Audio Controls**: Mute and pause buttons for controlling sound playback
- **Persistent Settings**: RPC endpoint is saved between sessions
- **Floating Controls**: Minimizable control panel with floating buttons for quick access
- **Interactive Controls**: Customize visual effects, audio parameters, and connection settings

## Setup

1. **Clone or download this project**

2. **Get an Ethereum RPC endpoint**:
   - Sign up for a free account at [Infura](https://infura.io) or [Alchemy](https://www.alchemy.com)
   - Create a new project and get your WebSocket endpoint URL
   - It should look like: `wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID`

3. **Run the visualizer**:
   - Option 1: Use a local web server (recommended)
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Node.js (install http-server globally first)
     npm install -g http-server
     http-server
     ```
   - Option 2: Open `index.html` directly in a modern web browser (some features may be limited)

4. **Connect to Ethereum**:
   - Enter your WebSocket RPC URL in the connection field
   - Click "Connect to Ethereum"
   - Click anywhere on the screen to enable audio

## Visual Elements

- **Particles**: Background particle field that responds to blockchain activity
- **Pending Transactions**: Distant white twinkling stars that merge into blocks when confirmed
- **ETH Transactions**: Solid colorful tetrahedrons that fly through space with trailing effects
- **ERC20 Transfers**: Green wireframe octahedrons, smaller and more delicate than ETH transfers
- **Smart Contract Calls**: Colorful shooting stars with trails, color based on function selector
- **Blocks**: Star constellations connected by glowing lines, growing spatially in branches
- **Expanding Universe**: 3D space grows organically as new blocks are added
- **Central Core**: A wireframe icosahedron representing the Ethereum world computer
- **Address Nodes**: Spherical nodes that grow with activity and show address labels
- **Transaction Flows**: Animated tubes connecting addresses (thick cyan for ETH, thin green for ERC20)
- **Background**: Smoothly throbs with purple/blue intensity based on current gas prices
- **Hover Tooltips**: Detailed information appears when hovering over any element

## Audio System

- **Multiple Sound Styles**: Choose from 5 different audio styles:
  - **Acid Techno**: 303-style bass with resonant filter sweeps
  - **Jazz**: Warm chords with reverb and complex harmonies
  - **Electronic**: Modulated synthesizers with delay effects
  - **Piano**: Harmonic piano tones with decay envelopes
  - **Minimal**: Simple sine wave tones for subtle ambience
- **Value-Based Audio**: Pitch, volume, and duration based on transaction amounts
- **Pending Transaction Sounds**: Ethereal, high-pitched shimmers that fade in and out
- **ETH Transaction Sounds**: Rich, dynamic tones that reflect transaction value
- **ERC20 Transfer Sounds**: Distinctive higher-pitched sequences 
- **Smart Contract Sounds**: Unique tones based on function selector with modulation
- **Block Sounds**: Deep sub-bass with harmonic chords and plucked melodies
- **Sequential Playback**: Transactions play sequentially over 12-second block periods
- **Effects**: Resonant filter with LFO, delay, reverb, and compression
- **Musical Scales**: Phrygian mode for that dark techno feel
- **Audio Controls**: Mute/unmute and pause/play functionality with floating buttons

## Controls

### Visual Settings
- **Color Intensity**: Adjusts the vibrancy of colors
- **Particle Density**: Number of background particles
- **Rotation Speed**: Speed of object rotations
- **Wave Amplitude**: Intensity of wave effects
- **Show Address Graph**: Toggle address nodes and transaction flows

### Audio Settings
- **Master Volume**: Overall sound level
- **Transaction Pitch**: Base frequency for transaction sounds
- **Block Bass Frequency**: Low frequency for block sounds
- **Reverb Amount**: Spatial echo effect
- **Filter Cutoff**: Frequency cutoff for the global filter
- **Filter Resonance**: Q factor for acid-style filter sweeps
- **Delay Time**: Echo delay timing
- **Delay Feedback**: Amount of delay repetitions
- **Sound Style**: Choose between Acid Techno, Jazz, Electronic, Piano, or Minimal

## Browser Requirements

- Modern browser with WebGL support (Chrome, Firefox, Safari, Edge)
- Web Audio API support
- WebSocket support

## Performance Tips

- Reduce particle count if experiencing lag
- Close other tabs for better performance
- Use a wired internet connection for stable blockchain streaming


---

**Note**: This visualizer requires an active internet connection and a valid Ethereum RPC endpoint to function properly.
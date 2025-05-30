# EtherTrip - Psychedelic Ethereum Visualizer 🌈🎵

Take a psychedelic journey through the Ethereum blockchain with real-time 3D visualization and immersive audio synthesis.

## Features

- **Pure Graph Visualization**: Spheres (EOA addresses) and pyramids (smart contracts) connected by animated transaction edges
- **Real-time Blockchain Streaming**: Live transaction and block data via WebSocket RPC connections
- **Smart Contract Distinction**: Randomized colorful pyramid shapes for visual contract identification  
- **Persistent Graph Edges**: Transaction connections remain visible for full block duration (12+ seconds)
- **Distance-Adaptive Scaling**: Objects remain visible when zooming out to large distances
- **Interactive 3D Navigation**: Full camera controls with orbit, zoom, and pan
- **Multiple RPC Providers**: Support for Infura, Alchemy, Tenderly, and free public nodes
- **Advanced Audio Engine**: 6 sound styles (Retro Synth, Piano, Acid Techno, Jazz, Electronic, Minimal)
- **Value-Based Audio**: Transaction sounds reflect ETH amounts and gas prices
- **ERC20 Token Support**: Visualizes token transfers with distinct audio and visual cues
- **Responsive UI**: Clean controls panel with floating buttons and connection status

## Setup

1. **Clone or download this project**

2. **Get an Ethereum RPC endpoint**:
   - you can use the publicly available ones but they will be rate limited or might be down. 
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

- **Address Nodes**: 
  - **EOA Addresses**: Spherical nodes in various colors that scale with activity
  - **Smart Contracts**: Pyramid shapes with randomized colors for visual distinction
- **Transaction Edges**: Curved 3D lines connecting sender and receiver nodes
  - **ETH Transfers**: Cyan colored curves with dynamic arc heights
  - **ERC20 Transfers**: Green colored curves with token-specific styling
  - **Persistent Duration**: Edges remain visible for 12+ seconds (full block time)
- **Distance-Adaptive Scaling**: All objects scale up when camera zooms out for better visibility
- **Particles**: Dynamic background particle field
- **Gas Price Effects**: Background color intensity responds to current gas prices
- **Interactive Labels**: Hover tooltips show transaction details and address information

## Audio System

- **6 Sound Styles**: 
  - **Retro Synth** (default): Classic synthesizer sounds
  - **Piano**: Harmonic piano tones with natural decay
  - **Acid Techno**: 303-style bass with resonant filter sweeps
  - **Jazz**: Warm chords with reverb and complex harmonies
  - **Electronic**: Modulated synthesizers with delay effects
  - **Minimal**: Simple sine wave tones for subtle ambience
- **Dynamic Audio**: Transaction sounds vary by value, gas price, and type
- **ETH Transactions**: Rich tones reflecting transaction amounts
- **ERC20 Transfers**: Distinctive token transfer audio signatures
- **Smart Contract Calls**: Unique modulated tones for contract interactions
- **Audio Controls**: Floating mute/unmute and pause/play buttons
- **Customizable Effects**: Adjustable reverb, delay, filter, and volume controls

## Controls

### Connection Settings
- **RPC Endpoint**: Choose from Infura, Alchemy, Tenderly, or free public nodes
- **API Key Support**: Built-in API key management for premium providers
- **Connection Status**: Real-time connection monitoring

### Visual Settings
- **Color Intensity**: Adjusts the vibrancy of colors
- **Particle Density**: Number of background particles
- **Rotation Speed**: Speed of object rotations
- **Wave Amplitude**: Intensity of wave effects
- **Item Lifespan**: How long visual elements persist (2-30 seconds)
- **Blockchain Focus**: Balance between effects and data visualization
- **Show Address Graph**: Toggle the transaction graph visualization

### Audio Settings
- **Sound Style**: Choose from 6 different audio engines
- **Master Volume**: Overall sound level
- **Transaction Pitch**: Base frequency for transaction sounds
- **Block Bass Frequency**: Low frequency for block sounds
- **Reverb Amount**: Spatial echo effect
- **Filter Cutoff & Resonance**: Real-time audio filtering
- **Delay Time & Feedback**: Echo and repeat effects

## Browser Requirements

- Modern browser with WebGL support (Chrome, Firefox, Safari, Edge)
- Web Audio API support
- WebSocket support

## Performance Tips

- Lower particle density if experiencing lag
- Reduce item lifespan for better performance with high transaction volumes
- Use free public nodes if you don't have an API key
- Close other browser tabs for optimal performance


## Known Issues & Limitations

- **Performance Degradation**: With high transaction volumes, performance may decrease over time due to accumulating visual elements
- **Memory Usage**: Extended sessions may consume increasing amounts of memory as the graph grows
- **Mobile Compatibility**: Touch controls and mobile browsers may have limited functionality
- **Network Sensitivity**: Unstable internet connections can cause visualization interruptions
- **RPC Rate Limits**: Some free RPC providers have rate limits that may affect real-time streaming
- **Audio Context**: Some browsers require user interaction before audio can play (click anywhere to enable)
- **Large Distance Scaling**: At extreme zoom levels, objects may become too large and overlap
- **Connection Recovery**: Manual reconnection may be required if WebSocket connection drops

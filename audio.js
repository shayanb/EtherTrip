class PsychedelicAudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.reverb = null;
        this.compressor = null;
        this.delay = null;
        this.filter = null;
        this.initialized = false;
        
        this.settings = {
            masterVolume: 50, // Store as 0-100 range
            transactionPitch: 440,
            blockBass: 80,
            reverbAmount: 0.3,
            filterCutoff: 2000,
            filterResonance: 10,
            delayTime: 0.375,
            delayFeedback: 0.5,
            soundStyle: 'minimal' // retro, piano, acid, jazz, electronic, minimal
        };
        
        this.isMuted = false;
        this.isPaused = false;
        
        this.activeOscillators = new Set();
        this.sequenceStep = 0;
        this.bpm = 130;
        this.nextStepTime = 0;
        
        this.scales = {
            minor: [0, 2, 3, 5, 7, 8, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            harmonic: [0, 2, 3, 5, 7, 8, 11]
        };
        this.currentScale = 'phrygian';
    }
    
    async init() {
        if (this.initialized) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = this.settings.filterCutoff;
        this.filter.Q.value = this.settings.filterResonance;
        
        this.delay = this.audioContext.createDelay(2);
        this.delay.delayTime.value = this.settings.delayTime;
        this.delayFeedback = this.audioContext.createGain();
        this.delayFeedback.gain.value = this.settings.delayFeedback;
        this.delayGain = this.audioContext.createGain();
        this.delayGain.gain.value = 0.4;
        
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        this.delay.connect(this.delayGain);
        
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.settings.masterVolume / 100;
        
        this.reverb = await this.createReverb();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = this.settings.reverbAmount;
        
        this.dryGain = this.audioContext.createGain();
        this.dryGain.gain.value = 1 - this.settings.reverbAmount;
        
        this.filter.connect(this.compressor);
        this.compressor.connect(this.dryGain);
        this.dryGain.connect(this.masterGain);
        
        this.compressor.connect(this.delay);
        this.delayGain.connect(this.masterGain);
        
        this.compressor.connect(this.reverb);
        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
        
        this.masterGain.connect(this.audioContext.destination);
        
        this.lfo = this.audioContext.createOscillator();
        this.lfo.frequency.value = 0.2;
        this.lfoGain = this.audioContext.createGain();
        this.lfoGain.gain.value = 800;
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.filter.frequency);
        this.lfo.start();
        
        this.initialized = true;
        
        this.startSequencer();
    }
    
    async createReverb() {
        const convolver = this.audioContext.createConvolver();
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 2;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.5);
            }
        }
        
        convolver.buffer = impulse;
        return convolver;
    }
    
    startSequencer() {
        const stepLength = 60 / this.bpm / 4;
        
        const scheduleStep = () => {
            const now = this.audioContext.currentTime;
            
            if (now >= this.nextStepTime) {
                this.nextStepTime = now + stepLength;
                
                this.playBeatForStyle(now);
                
                this.sequenceStep++;
            }
            
            requestAnimationFrame(scheduleStep);
        };
        
        scheduleStep();
    }
    
    playKick(time) {
        if (this.isMuted) return;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.frequency.setValueAtTime(60, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.5);
    }
    
    playSnare(time) {
        if (this.isMuted) return;
        
        const noise = this.audioContext.createBufferSource();
        const noiseBuffer = this.audioContext.createBuffer(1, 0.1 * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = noiseBuffer;
        
        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.2, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        
        noise.start(time);
    }
    
    playHiHat(time, isOpen) {
        if (this.isMuted) return;
        
        const noise = this.audioContext.createBufferSource();
        const noiseBuffer = this.audioContext.createBuffer(1, 0.05 * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = noiseBuffer;
        
        const hihatFilter = this.audioContext.createBiquadFilter();
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 7000;
        
        const hihatGain = this.audioContext.createGain();
        hihatGain.gain.setValueAtTime(0.05, time);
        hihatGain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.3 : 0.05));
        
        noise.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(this.masterGain);
        
        noise.start(time);
    }
    
    playBeatForStyle(time) {
        if (this.isMuted) return;
        
        const step = this.sequenceStep % 16;
        
        switch (this.settings.soundStyle) {
            case 'acid':
                // Classic acid techno pattern
                if (step % 4 === 0) this.playKick(time);
                if (step === 6 || step === 14) this.playSnare(time);
                if (step % 2 === 0) this.playHiHat(time, step % 8 === 0);
                break;
                
            case 'jazz':
                // Jazzy swing pattern
                if (step === 0 || step === 12) this.playKick(time);
                if (step === 4 || step === 12) this.playSnare(time);
                if (step % 3 === 0) this.playHiHat(time, false);
                break;
                
            case 'electronic':
                // Electronic dance pattern
                if (step % 4 === 0) this.playKick(time);
                if (step === 4 || step === 12) this.playSnare(time);
                if (step % 1 === 0) this.playHiHat(time, step % 4 === 2);
                break;
                
            case 'piano':
                // Minimal piano backing
                if (step === 0 || step === 8) this.playKick(time);
                if (step === 6) this.playSnare(time);
                if (step % 4 === 2) this.playHiHat(time, false);
                break;
                
            case 'minimal':
                // Very sparse minimal pattern
                if (step === 0) this.playKick(time);
                if (step === 8) this.playSnare(time);
                if (step === 4 || step === 12) this.playHiHat(time, false);
                break;
                
            case 'retro':
                // Classic 80s synth-pop pattern
                if (step % 4 === 0) this.playKick(time);
                if (step === 4 || step === 12) this.playSnare(time);
                if (step % 2 === 1) this.playHiHat(time, step === 7 || step === 15);
                // Add classic 80s gated reverb snare
                if (step === 6) this.playRetroGateSnare(time);
                break;
                
            default:
                // Fallback to acid pattern
                if (step % 4 === 0) this.playKick(time);
                if (step === 6 || step === 14) this.playSnare(time);
                if (step % 2 === 0) this.playHiHat(time, step % 8 === 0);
        }
    }
    
    playTransaction(tx) {
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const value = parseInt(tx.value || '0', 16);
        const valueInEth = value / 1e18;
        const gasPrice = parseInt(tx.gasPrice || '0', 16);
        
        // VALUE-BASED AUDIO PROCESSING SYSTEM
        // This system works independently of sound packs and applies universal value-based changes
        const audioParams = this.calculateValueBasedParameters(valueInEth, gasPrice, tx);
        
        if (this.settings.soundStyle === 'acid') {
            this.playAcidTransaction(audioParams, now);
        } else if (this.settings.soundStyle === 'jazz') {
            this.playJazzTransaction(audioParams, now);
        } else if (this.settings.soundStyle === 'electronic') {
            this.playElectronicTransaction(audioParams, now);
        } else if (this.settings.soundStyle === 'piano') {
            this.playPianoTransaction(audioParams, now);
        } else if (this.settings.soundStyle === 'minimal') {
            this.playMinimalTransaction(audioParams, now);
        } else if (this.settings.soundStyle === 'retro') {
            this.playRetroTransaction(audioParams, now);
        }
    }
    
    playAcidTransaction(audioParams, now) {
        // ACID PACK: Raw sawtooth waves with aggressive resonant filtering
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const acidFilter = this.audioContext.createBiquadFilter();
        const distortion = this.audioContext.createWaveShaper();
        
        // Classic 303-style sawtooth
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(audioParams.frequency, now);
        
        // Aggressive resonant lowpass filter with VALUE-BASED sweep
        acidFilter.type = 'lowpass';
        acidFilter.frequency.setValueAtTime(150, now);
        acidFilter.frequency.exponentialRampToValueAtTime(150 + audioParams.filterSweepRange, now + 0.08);
        acidFilter.frequency.exponentialRampToValueAtTime(150, now + audioParams.duration * 0.9);
        acidFilter.Q.value = 25 + audioParams.resonanceBoost; // Gas price affects resonance
        
        // VALUE-BASED distortion intensity
        const curve = new Float32Array(256);
        const saturation = 2 + audioParams.saturationAmount * 3; // Higher value = more distortion
        for (let i = 0; i < 256; i++) {
            const x = (i - 128) / 128;
            curve[i] = Math.tanh(x * saturation) * 0.7;
        }
        distortion.curve = curve;
        
        // VALUE-BASED envelope (faster attack for high value)
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(audioParams.volume * 1.2, now + audioParams.attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + audioParams.duration);
        
        // VALUE-BASED stereo panning
        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = audioParams.pan;
        
        // Audio routing: osc -> filter -> distortion -> gain -> panner -> global filter
        osc.connect(acidFilter);
        acidFilter.connect(distortion);
        distortion.connect(gain);
        gain.connect(panner);
        panner.connect(this.filter);
        
        osc.start(now);
        osc.stop(now + audioParams.duration);
        
        this.activeOscillators.add(osc);
        osc.onended = () => this.activeOscillators.delete(osc);
    }
    
    playJazzTransaction(audioParams, now) {
        // JAZZ PACK: Warm harmonies, complex chords, natural acoustic feel
        // VALUE-BASED chord complexity
        const chordType = audioParams.isHighValue ? [0, 3, 7, 10, 14] : [0, 4, 7]; // Major 7th or simple triad
        const warmth = this.audioContext.createBiquadFilter();
        const panner = this.audioContext.createStereoPanner();
        
        // VALUE-BASED warmth filter
        warmth.type = 'lowpass';
        warmth.frequency.value = 3000 + (audioParams.valueInEth * 500); // Brighter for higher values
        warmth.Q.value = 0.7;
        
        // VALUE-BASED stereo positioning
        panner.pan.value = audioParams.pan;
        
        chordType.forEach((interval, index) => {
            const noteFreq = audioParams.frequency * Math.pow(2, interval / 12);
            const stagger = index * 0.03; // Gentle chord roll
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const compressor = this.audioContext.createDynamicsCompressor();
            
            // Warm sine waves with subtle triangle blend
            osc.type = index === 0 ? 'triangle' : 'sine'; // Root note has more body
            osc.frequency.setValueAtTime(noteFreq, now + stagger);
            
            // VALUE-BASED envelope (using calculated parameters)
            const noteVolume = audioParams.volume / chordType.length * 0.8;
            gain.gain.setValueAtTime(0, now + stagger);
            gain.gain.linearRampToValueAtTime(noteVolume, now + stagger + audioParams.attack);
            gain.gain.exponentialRampToValueAtTime(noteVolume * audioParams.sustain, now + stagger + audioParams.decay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + stagger + audioParams.duration);
            
            // Gentle compression for smoothness
            compressor.threshold.value = -20;
            compressor.ratio.value = 3;
            
            // Audio routing: osc -> warmth filter -> compressor -> gain -> panner -> reverb (VALUE-BASED reverb send)
            osc.connect(warmth);
            warmth.connect(compressor);
            compressor.connect(gain);
            gain.connect(panner);
            panner.connect(this.reverb);
            
            osc.start(now + stagger);
            osc.stop(now + stagger + audioParams.duration);
        });
    }
    
    playElectronicTransaction(audioParams, now) {
        // ELECTRONIC PACK: Digital synthesis, modulation, spacious delays
        const carrier = this.audioContext.createOscillator();
        const modulator = this.audioContext.createOscillator();
        const modulatorGain = this.audioContext.createGain();
        const gain = this.audioContext.createGain();
        const digitalFilter = this.audioContext.createBiquadFilter();
        const chorus = this.audioContext.createDelay();
        const chorusGain = this.audioContext.createGain();
        
        // FM synthesis for digital character - SOFTENED
        carrier.type = 'triangle'; // Much softer than sawtooth
        carrier.frequency.setValueAtTime(audioParams.frequency, now);
        
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(audioParams.frequency * 0.5, now); // Harmonic instead of sub-harmonic
        
        // VALUE-BASED modulation amount - REDUCED
        modulatorGain.gain.setValueAtTime(audioParams.frequency * 0.02 * (1 + audioParams.valueInEth * 0.3), now); // Much gentler modulation
        
        // VALUE-BASED digital filter with movement - REDUCED frequencies
        digitalFilter.type = 'lowpass'; // Warmer than notch
        digitalFilter.frequency.setValueAtTime(Math.min(audioParams.frequency * 2, 1500), now);
        digitalFilter.frequency.exponentialRampToValueAtTime(Math.min(audioParams.frequency * 3, 2000), now + audioParams.duration * 0.6);
        digitalFilter.frequency.exponentialRampToValueAtTime(Math.min(audioParams.frequency * 1.5, 1200), now + audioParams.duration);
        digitalFilter.Q.value = 2; // Low resonance to avoid harshness
        
        // VALUE-BASED chorus for width - REDUCED
        chorus.delayTime.value = 0.02; // Longer delay for smoother chorus
        chorusGain.gain.value = 0.15 * audioParams.effectsIntensity; // Reduced chorus intensity
        
        // VALUE-BASED sharp electronic envelope - SOFTENED
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(audioParams.volume * 0.5, now + Math.max(audioParams.attack, 0.015)); // Even softer volume and attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + audioParams.duration);
        
        // Audio routing: modulator -> modulatorGain -> carrier frequency (FM)
        // carrier -> digitalFilter -> gain -> delay (with chorus)
        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);
        
        carrier.connect(digitalFilter);
        digitalFilter.connect(gain);
        digitalFilter.connect(chorus);
        chorus.connect(chorusGain);
        
        // VALUE-BASED stereo panning
        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = audioParams.pan;
        
        gain.connect(panner);
        chorusGain.connect(panner);
        panner.connect(this.delay);
        
        carrier.start(now);
        carrier.stop(now + audioParams.duration);
        modulator.start(now);
        modulator.stop(now + audioParams.duration);
    }
    
    playPianoTransaction(audioParams, now) {
        // PIANO PACK: Rich harmonics, natural acoustic resonance, warm decay
        const fundamental = this.audioContext.createOscillator();
        const harmonics = [];
        const gains = [];
        const pianoFilter = this.audioContext.createBiquadFilter();
        const resonance = this.audioContext.createConvolver();
        
        // Create piano-like harmonic series - REDUCED for less harshness
        const harmonicRatios = [1, 2, 3]; // Fewer harmonics to reduce harshness
        const harmonicLevels = [0.7, 0.2, 0.1]; // Much gentler harmonic falloff
        
        harmonicRatios.forEach((ratio, index) => {
            const harmonic = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            // Use sine waves for all harmonics for warmer tone
            harmonic.type = 'sine';
            harmonic.frequency.setValueAtTime(audioParams.frequency * ratio, now);
            
            // VALUE-BASED piano envelope with rich harmonic control - REDUCED volume
            const harmLevel = audioParams.volume * harmonicLevels[index] * 0.6; // Removed value scaling, reduced overall
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(harmLevel, now + Math.max(audioParams.attack, 0.02)); // Minimum 20ms attack to reduce clicks
            gain.gain.exponentialRampToValueAtTime(harmLevel * audioParams.sustain * 0.8, now + audioParams.decay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + audioParams.duration);
            
            harmonics.push(harmonic);
            gains.push(gain);
            
            harmonic.connect(gain);
            gain.connect(pianoFilter);
        });
        
        // VALUE-BASED warm acoustic filter - REDUCED high frequencies
        pianoFilter.type = 'lowpass';
        pianoFilter.frequency.value = Math.min(1800 + (audioParams.valueInEth * 200), 2200); // Much warmer, capped at 2.2kHz
        pianoFilter.Q.value = 0.2; // Even gentler rolloff
        
        // VALUE-BASED stereo panning
        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = audioParams.pan;
        
        // Audio routing: harmonics -> piano filter -> panner -> reverb
        pianoFilter.connect(panner);
        panner.connect(this.reverb);
        
        // Start all harmonics with VALUE-BASED timing
        harmonics.forEach((harmonic, index) => {
            harmonic.start(now);
            harmonic.stop(now + audioParams.duration);
        });
    }
    
    playMinimalTransaction(audioParams, now) {
        // MINIMAL PACK: Pure tones, simple shapes, clean and sparse
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const minimalFilter = this.audioContext.createBiquadFilter();
        
        // Pure sine wave
        osc.type = 'sine';
        osc.frequency.setValueAtTime(audioParams.frequency, now);
        
        // Clean highpass filter for clarity
        minimalFilter.type = 'highpass';
        minimalFilter.frequency.value = 150;
        minimalFilter.Q.value = 0.7;
        
        // VALUE-BASED sharp, precise envelope
        const sustainVolume = audioParams.volume * 0.4;
        const shortDuration = Math.min(audioParams.duration, 0.2 + audioParams.valueInEth * 0.1); // Brief, value-dependent
        
        // VALUE-BASED stereo panning
        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = audioParams.pan;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(sustainVolume, now + audioParams.attack);
        gain.gain.linearRampToValueAtTime(sustainVolume * 0.8, now + shortDuration * 0.3);
        gain.gain.linearRampToValueAtTime(0, now + shortDuration);
        
        // Audio routing: osc -> minimal filter -> gain -> panner -> direct to master (clean)
        osc.connect(minimalFilter);
        minimalFilter.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + shortDuration);
    }
    
    playERC20Transfer(transfer) {
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const value = parseFloat(transfer.value || '0') / 1e18;
        
        // Use value to determine characteristics 
        const valueRange = Math.log10(Math.max(value, 0.001) + 1);
        const note = this.getScaleNote(Math.floor(value * 10) % 12 + Math.floor(valueRange));
        const frequency = (this.settings.transactionPitch * 1.5) * Math.pow(2, note / 12);
        
        const volume = Math.min(0.15, 0.03 + valueRange * 0.05);
        const duration = Math.min(1, 0.3 + valueRange * 0.2);
        
        if (this.settings.soundStyle === 'acid') {
            this.playERC20Acid(frequency, volume, duration, value, now);
        } else if (this.settings.soundStyle === 'jazz') {
            this.playERC20Jazz(frequency, volume, duration, value, now);
        } else if (this.settings.soundStyle === 'electronic') {
            this.playERC20Electronic(frequency, volume, duration, value, now);
        } else if (this.settings.soundStyle === 'piano') {
            this.playERC20Piano(frequency, volume, duration, value, now);
        } else if (this.settings.soundStyle === 'minimal') {
            this.playERC20Minimal(frequency, volume, duration, value, now);
        } else if (this.settings.soundStyle === 'retro') {
            this.playERC20Retro(frequency, volume, duration, value, now);
        }
    }
    
    playERC20Acid(frequency, volume, duration, value, now) {
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const ringMod = this.audioContext.createGain();
        const erc20Filter = this.audioContext.createBiquadFilter();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(frequency, now);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(frequency * 1.5, now);
        
        erc20Filter.type = 'highpass';
        erc20Filter.frequency.setValueAtTime(800, now);
        erc20Filter.frequency.exponentialRampToValueAtTime(2000 + value * 200, now + 0.1);
        erc20Filter.frequency.exponentialRampToValueAtTime(800, now + duration);
        erc20Filter.Q.value = 5 + value * 2;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc1.connect(ringMod);
        osc2.connect(ringMod.gain);
        ringMod.connect(erc20Filter);
        erc20Filter.connect(gain);
        gain.connect(this.filter);
        
        osc1.start(now);
        osc1.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);
        
        if (value > 100) {
            this.playERC20Arp(frequency, now);
        }
    }
    
    playERC20Jazz(frequency, volume, duration, value, now) {
        // Play a jazzy bell-like sound
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency * 2, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(gain);
        gain.connect(this.reverb);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playERC20Electronic(frequency, volume, duration, value, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'triangle'; // Changed from sawtooth to triangle
        osc.frequency.setValueAtTime(frequency * 1.5, now); // Reduced from 2x
        
        filter.type = 'lowpass'; // Changed from notch to lowpass
        filter.frequency.setValueAtTime(frequency * 2, now);
        filter.frequency.exponentialRampToValueAtTime(frequency * 3, now + duration);
        filter.Q.value = 3; // Much lower Q value
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.delay);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playERC20Piano(frequency, volume, duration, value, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sine'; // Changed to sine for softer tone
        osc.frequency.setValueAtTime(frequency * 1.5, now); // Reduced from 2x to 1.5x
        
        // Add filter to reduce harshness
        filter.type = 'lowpass';
        filter.frequency.value = 1500;
        filter.Q.value = 0.5;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.01); // Softer volume and attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playERC20Minimal(frequency, volume, duration, value, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency * 3, now);
        
        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.05);
    }
    
    playSmartContract(tx) {
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const value = parseInt(tx.value || '0', 16) / 1e18;
        const gasPrice = parseInt(tx.gasPrice || '0', 16);
        
        // SMART CONTRACT DISTINCT PROCESSING - Enhanced with function selector
        const functionSelector = tx.calldata ? tx.calldata.slice(0, 10) : '0x00000000';
        const selectorValue = parseInt(functionSelector.slice(2, 6), 16);
        
        // Create special audio parameters for smart contracts
        const contractParams = this.calculateSmartContractParameters(value, gasPrice, tx, functionSelector, selectorValue);
        
        // Smart contracts use a completely different audio approach - multi-layered synthesis
        this.playDistinctSmartContract(contractParams, now);
    }
    
    playSmartContractAcid(baseFreq, volume, duration, selectorValue, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.linearRampToValueAtTime(baseFreq * 2, now + duration * 0.3);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + duration);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(baseFreq * 0.5, now);
        filter.frequency.exponentialRampToValueAtTime(baseFreq * 4, now + duration * 0.2);
        filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + duration);
        filter.Q.value = 20 + (selectorValue % 15);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.filter);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playSmartContractJazz(baseFreq, volume, duration, selectorValue, now) {
        // Play a complex jazz chord progression
        const intervals = [0, 4, 7, 11, 14]; // Major 7th chord with extensions
        
        intervals.forEach((interval, index) => {
            const freq = baseFreq * Math.pow(2, interval / 12);
            const delay = index * 0.03;
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(volume / intervals.length, now + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
            
            osc.connect(gain);
            gain.connect(this.reverb);
            
            osc.start(now + delay);
            osc.stop(now + delay + duration);
        });
    }
    
    playSmartContractElectronic(baseFreq, volume, duration, selectorValue, now) {
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const modulator = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc1.type = 'triangle'; // Changed from square to triangle
        osc1.frequency.setValueAtTime(baseFreq, now);
        
        osc2.type = 'sine'; // Changed from sawtooth to sine
        osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
        
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(3 + (selectorValue % 10), now); // Reduced modulation rate
        
        modGain.gain.setValueAtTime(baseFreq * 0.03, now); // Reduced modulation depth
        
        modulator.connect(modGain);
        modGain.connect(osc1.frequency);
        
        // Add filter to reduce harshness
        filter.type = 'lowpass';
        filter.frequency.value = Math.min(baseFreq * 4, 2000); // Cap at 2kHz
        filter.Q.value = 2;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.03); // Softer volume and attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.delay);
        
        osc1.start(now);
        osc1.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);
        modulator.start(now);
        modulator.stop(now + duration);
    }
    
    playSmartContractPiano(baseFreq, volume, duration, selectorValue, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sine'; // Changed to sine for softer tone
        osc.frequency.setValueAtTime(baseFreq, now);
        
        // Add filter to reduce harshness
        filter.type = 'lowpass';
        filter.frequency.value = Math.min(baseFreq * 3, 1800); // Cap at 1800Hz
        filter.Q.value = 0.5;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.02); // Softer volume and attack
        gain.gain.exponentialRampToValueAtTime(volume * 0.15, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playSmartContractMinimal(baseFreq, volume, duration, selectorValue, now) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        
        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }
    
    playERC20Arp(baseFrequency, startTime) {
        const pattern = [0, 7, 12, 7];
        const stepTime = 0.05;
        
        pattern.forEach((interval, index) => {
            const time = startTime + (index * stepTime);
            const freq = baseFrequency * Math.pow(2, interval / 12);
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.05, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            
            osc.connect(gain);
            gain.connect(this.filter);
            
            osc.start(time);
            osc.stop(time + 0.1);
        });
    }
    
    playAcidSequence(baseFrequency, startTime) {
        const pattern = [0, 0, 12, 0, -12, 0, 7, 0];
        const stepTime = 60 / this.bpm / 4;
        
        pattern.forEach((interval, index) => {
            const time = startTime + (index * stepTime);
            const freq = baseFrequency * Math.pow(2, interval / 12);
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const acidFilter = this.audioContext.createBiquadFilter();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            
            acidFilter.type = 'lowpass';
            acidFilter.frequency.setValueAtTime(100, time);
            acidFilter.frequency.exponentialRampToValueAtTime(1000 + Math.random() * 2000, time + 0.05);
            acidFilter.frequency.exponentialRampToValueAtTime(100, time + stepTime * 0.8);
            acidFilter.Q.value = 20;
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.1, time + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, time + stepTime * 0.9);
            
            osc.connect(acidFilter);
            acidFilter.connect(gain);
            gain.connect(this.filter);
            
            osc.start(time);
            osc.stop(time + stepTime);
        });
    }
    
    playBlock(block) {
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const transactionCount = block.transactions ? block.transactions.length : 0;
        
        const bassOsc = this.audioContext.createOscillator();
        const bassGain = this.audioContext.createGain();
        const bassFilter = this.audioContext.createBiquadFilter();
        
        bassOsc.type = 'square';
        bassOsc.frequency.value = this.settings.blockBass;
        
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(50, now);
        bassFilter.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        bassFilter.frequency.exponentialRampToValueAtTime(50, now + 2);
        bassFilter.Q.value = 10;
        
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        bassGain.gain.setValueAtTime(0.3, now + 0.5);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
        
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.masterGain);
        
        bassOsc.start(now);
        bassOsc.stop(now + 2);
        
        const chordFrequencies = [
            this.settings.blockBass * 2,
            this.settings.blockBass * 2.5,
            this.settings.blockBass * 3,
            this.settings.blockBass * 4
        ];
        
        chordFrequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.playChordNote(freq, 0.05, 1);
            }, index * 50);
        });
        
        for (let i = 0; i < Math.min(transactionCount, 8); i++) {
            setTimeout(() => {
                const note = this.getScaleNote(i * 3);
                const frequency = 440 * Math.pow(2, note / 12);
                this.playPluck(frequency, 0.1);
            }, i * 100);
        }
    }
    
    playChordNote(frequency, volume, duration) {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(gain);
        gain.connect(this.filter);
        
        osc.start(now);
        osc.stop(now + duration);
    }
    
    playPluck(frequency, volume) {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const pluckFilter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        
        pluckFilter.type = 'lowpass';
        pluckFilter.frequency.setValueAtTime(frequency * 4, now);
        pluckFilter.frequency.exponentialRampToValueAtTime(frequency * 0.5, now + 0.2);
        pluckFilter.Q.value = 5;
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.connect(pluckFilter);
        pluckFilter.connect(gain);
        gain.connect(this.filter);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }
    
    // RETRO SYNTH PACK - Classic 80s synthesizer sounds
    playRetroTransaction(audioParams, now) {
        // Classic 80s DX7-style FM synthesis with chorus
        const carrier = this.audioContext.createOscillator();
        const modulator = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        const gain = this.audioContext.createGain();
        const chorus = this.createRetroChorus();
        
        // FM synthesis setup
        carrier.type = 'sine';
        modulator.type = 'sine';
        
        carrier.frequency.value = audioParams.frequency;
        modulator.frequency.value = audioParams.frequency * 2.1; // Classic FM ratio
        
        // Modulation depth based on transaction value
        const modDepth = 30 + (audioParams.valueRange * 50);
        modGain.gain.value = modDepth;
        
        // Classic 80s envelope
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(audioParams.volume * 0.7, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(audioParams.volume * 0.4, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + audioParams.duration);
        
        // Connect FM synthesis chain
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(gain);
        gain.connect(chorus);
        chorus.connect(this.panner);
        
        // Pan based on transaction hash for stereo width
        this.panner.pan.value = audioParams.pan;
        
        carrier.start(now);
        modulator.start(now);
        carrier.stop(now + audioParams.duration);
        modulator.stop(now + audioParams.duration);
    }
    
    playERC20Retro(frequency, volume, duration, value, now) {
        // Classic arpeggiator sound for ERC20 transfers
        const arpNotes = [0, 4, 7, 12]; // Major triad + octave
        
        arpNotes.forEach((semitone, index) => {
            setTimeout(() => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const chorus = this.createRetroChorus();
                
                osc.type = 'square';
                osc.frequency.value = frequency * Math.pow(2, semitone / 12);
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                
                osc.connect(gain);
                gain.connect(chorus);
                chorus.connect(this.reverb);
                
                osc.start(now);
                osc.stop(now + 0.15);
            }, index * 80); // Classic arpeggiator timing
        });
    }
    
    playRetroGateSnare(time) {
        // Classic 80s gated reverb snare
        const noise = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gain = this.audioContext.createGain();
        const gate = this.audioContext.createGain();
        
        // Create noise buffer
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;
        
        // Filter for snare tone
        filter.type = 'bandpass';
        filter.frequency.value = 200;
        filter.Q.value = 0.5;
        
        // Classic gated envelope
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        // Gate effect - classic 80s sound
        gate.gain.setValueAtTime(1, time);
        gate.gain.setValueAtTime(1, time + 0.05);
        gate.gain.setValueAtTime(0, time + 0.051);
        gate.gain.setValueAtTime(0, time + 0.1);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(gate);
        gate.connect(this.reverb);
        
        noise.start(time);
        noise.stop(time + 0.1);
    }
    
    createRetroChorus() {
        // Simplified retro chorus effect
        const delay = this.audioContext.createDelay(0.05);
        const feedback = this.audioContext.createGain();
        
        // Classic chorus timing
        delay.delayTime.value = 0.025;
        feedback.gain.value = 0.3;
        
        // Simple feedback loop for chorus
        delay.connect(feedback);
        feedback.connect(delay);
        
        return delay;
    }
    
    getScaleNote(index) {
        const scale = this.scales[this.currentScale];
        const octave = Math.floor(index / scale.length);
        const noteIndex = index % scale.length;
        return scale[noteIndex] + (octave * 12);
    }
    
    getMusicalNote(noteIndex) {
        // RESEARCH-BASED PLEASANT PIANO FREQUENCIES
        // Based on equal temperament theory and human hearing comfort zones
        
        // Define pleasant musical scales with emphasis on consonant intervals
        const pianoScales = {
            major: [0, 2, 4, 5, 7, 9, 11],           // C major - most consonant
            pentatonic: [0, 2, 4, 7, 9],            // Pentatonic - no dissonant intervals
            minor: [0, 2, 3, 5, 7, 8, 10],          // Natural minor
            dorian: [0, 2, 3, 5, 7, 9, 10],         // Dorian mode
            wholeTone: [0, 2, 4, 6, 8, 10],         // Whole tone - dreamy
            blues: [0, 3, 5, 6, 7, 10]              // Blues scale
        };
        
        // Choose scale - default to pentatonic for maximum pleasantness
        let scale;
        switch (this.settings.soundStyle) {
            case 'jazz':
                scale = pianoScales.dorian;
                break;
            case 'acid':
            case 'electronic':
                scale = pianoScales.wholeTone;
                break;
            case 'minimal':
                scale = pianoScales.pentatonic;
                break;
            case 'retro':
                scale = pianoScales.pentatonic; // Retro sounds best with pentatonic
                break;
            case 'piano':
            default:
                scale = pianoScales.pentatonic; // Changed from major to pentatonic for pleasantness
        }
        
        // Calculate note within comfortable piano range
        // Research shows pleasant frequencies: 110Hz-2kHz core range
        // Piano C4 (middle C) = 261.63 Hz
        const octave = Math.floor(noteIndex / scale.length);
        const scaleIndex = noteIndex % scale.length;
        
        // Constrain to pleasant octave range (C3 to C6)
        // C3 = -12 semitones from middle C, C6 = +24 semitones from middle C
        const constrainedOctave = Math.max(0, Math.min(2, octave)); // Max 2 octaves up
        const constrainedNote = scale[scaleIndex] + (constrainedOctave * 12) - 12; // Start from C3
        
        // Final range check: keep between C3 (-12) and C6 (+24)
        const finalNote = Math.max(-12, Math.min(24, constrainedNote));
        
        return finalNote;
    }
    
    updateSettings(settings) {
        Object.assign(this.settings, settings);
        
        if (this.initialized) {
            const now = this.audioContext.currentTime;
            
            if (settings.masterVolume !== undefined) {
                this.settings.masterVolume = settings.masterVolume;
                this.masterGain.gain.linearRampToValueAtTime(this.settings.masterVolume / 100, now + 0.1);
            }
            
            if (settings.reverbAmount !== undefined) {
                this.reverbGain.gain.linearRampToValueAtTime(settings.reverbAmount / 100, now + 0.1);
                this.dryGain.gain.linearRampToValueAtTime(1 - (settings.reverbAmount / 100), now + 0.1);
            }
            
            if (settings.filterCutoff !== undefined) {
                this.filter.frequency.linearRampToValueAtTime(settings.filterCutoff, now + 0.1);
            }
            
            if (settings.filterResonance !== undefined) {
                this.filter.Q.linearRampToValueAtTime(settings.filterResonance, now + 0.1);
            }
            
            if (settings.delayTime !== undefined) {
                this.delay.delayTime.linearRampToValueAtTime(settings.delayTime, now + 0.1);
            }
            
            if (settings.delayFeedback !== undefined) {
                this.delayFeedback.gain.linearRampToValueAtTime(settings.delayFeedback, now + 0.1);
            }
            
            if (settings.transactionPitch !== undefined) {
                const targetBPM = 100 + (settings.transactionPitch / 1000) * 60;
                this.bpm = Math.max(100, Math.min(160, targetBPM));
            }
        }
    }
    
    playPendingTransaction(tx) {
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        
        // Create a very subtle, ethereal sound
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Use high frequencies for ethereal effect
        const baseFreq = 800 + Math.random() * 400;
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, now);
        osc1.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + 2);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 1.01, now); // Slight detune for shimmer
        osc2.frequency.linearRampToValueAtTime(baseFreq * 1.51, now + 2);
        
        filter.type = 'highpass';
        filter.frequency.value = 600;
        filter.Q.value = 0.5;
        
        // Very quiet and subtle
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.5);
        gain.gain.linearRampToValueAtTime(0.02, now + 1.5);
        gain.gain.linearRampToValueAtTime(0, now + 2);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(filter);
        filter.connect(this.reverb); // Direct to reverb for space
        
        osc1.start(now);
        osc1.stop(now + 2);
        osc2.start(now);
        osc2.stop(now + 2);
    }
    
    mute() {
        this.isMuted = true;
        if (this.initialized) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
        }
    }
    
    unmute() {
        this.isMuted = false;
        if (this.initialized) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(this.settings.masterVolume / 100, now + 0.1);
        }
    }
    
    pause() {
        this.isPaused = true;
        if (this.audioContext) {
            this.audioContext.suspend();
        }
    }
    
    unpause() {
        this.isPaused = false;
        if (this.audioContext) {
            this.audioContext.resume();
        }
    }
    
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    playNewAddress(address) {
        // Subtle sound for new address appearance - works across all sound kits
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        
        // Create subtle chime based on address hash
        const addressHash = parseInt(address.slice(-8), 16);
        const noteIndex = addressHash % 12;
        const baseFreq = 880; // High A note for subtlety
        const frequency = baseFreq * Math.pow(2, noteIndex / 12);
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sine'; // Pure sine for subtle effect
        osc.frequency.value = frequency;
        
        // Very subtle volume (2% of max)
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        // Gentle highpass filter for crystalline quality
        filter.type = 'highpass';
        filter.frequency.value = 600;
        filter.Q.value = 1;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }
    
    playNewTransaction() {
        // Subtle sound for new transaction appearance - works across all sound kits
        if (!this.initialized || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        
        // Create subtle click/tick sound
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Brief filtered noise burst
        osc.type = 'square';
        osc.frequency.value = 1200 + Math.random() * 400; // High frequency click
        
        // Very brief and subtle (1.5% volume)
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.015, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        
        // Bandpass filter for defined click
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 3;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.delay); // Slight delay for spatial effect
        
        osc.start(now);
        osc.stop(now + 0.08);
    }
    
    calculateValueBasedParameters(valueInEth, gasPrice, tx) {
        // VALUE-BASED AUDIO PROCESSING SYSTEM
        // Universal system that works independently of sound packs
        
        // Base value calculations
        const valueRange = Math.log10(Math.max(valueInEth, 0.001) + 1); // Log scale for better distribution
        const gasPriceGwei = gasPrice / 1e9;
        const isHighValue = valueInEth > 1; // 1+ ETH transactions
        const isMediumValue = valueInEth > 0.1; // 0.1+ ETH transactions
        
        // MUSICAL FREQUENCY CALCULATION - Research-based pleasant audio
        // Use transaction hash for consistent but varied note selection
        const hashInt = parseInt(tx.hash ? tx.hash.slice(-8) : '0', 16);
        const noteIndex = hashInt % 24; // 24 note range for more variety
        const limitedNote = this.getMusicalNote(noteIndex);
        
        // Calculate frequency using equal temperament: f = 440 * 2^((n-69)/12)
        // A4 = 440Hz is note 69 in MIDI, middle C (C4) is note 60
        const midiNote = 60 + limitedNote; // Start from middle C
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
        
        // ENHANCED FREQUENCY SAFETY - Research-based pleasant ranges
        // Core pleasant range: 110Hz-2kHz with special handling for extremes
        let safeFrequency;
        if (frequency < 110) {
            safeFrequency = 110 + (frequency % 55); // Keep low frequencies in 110-165Hz range
        } else if (frequency > 1760) { // High G6
            safeFrequency = 880 + (frequency % 440); // Keep high frequencies in 880-1320Hz range  
        } else {
            safeFrequency = frequency; // Frequency is already in pleasant range
        }
        
        // VOLUME SCALING (logarithmic) - STRICTER LIMITS for ear safety
        const baseVolume = Math.min(0.12, 0.02 + valueRange * 0.06); // Reduced from 0.3 to 0.12 max
        const volume = isHighValue ? baseVolume * 1.1 : baseVolume; // Reduced boost from 1.3x to 1.1x
        
        // ADDITIONAL VOLUME SAFETY for block transaction overwhelm
        const finalVolume = Math.min(volume, 0.08); // Hard limit: never exceed 8% volume
        
        // DURATION SCALING
        const baseDuration = Math.min(3, 0.4 + valueRange * 0.4);
        const duration = isHighValue ? baseDuration * 1.2 : baseDuration;
        
        // STEREO PANNING (based on transaction hash for consistent positioning)
        const hashSeed = tx.hash ? parseInt(tx.hash.slice(-2), 16) : 128;
        const pan = (hashSeed / 255) * 2 - 1; // -1 to 1 range
        
        // EFFECTS INTENSITY (based on value and gas price)
        const effectsIntensity = Math.min(1, 0.3 + valueRange * 0.4 + (gasPriceGwei / 100) * 0.2);
        const reverbSend = isHighValue ? 0.8 : 0.4; // High value = more reverb
        const delaySend = isMediumValue ? 0.6 : 0.2; // Medium+ value = more delay
        
        // HARMONIC RICHNESS (more harmonics for higher values)
        const harmonicCount = Math.min(6, 2 + Math.floor(valueRange * 2));
        const harmonicSpread = isHighValue ? 1.2 : 0.8; // Wider harmonic spread for high value
        
        // ENVELOPE CHARACTERISTICS
        const attack = isHighValue ? 0.002 : 0.01; // Faster attack for high value
        const decay = valueRange * 0.1 + 0.05; // Longer decay for higher values
        const sustain = Math.min(0.8, 0.3 + valueRange * 0.3);
        const release = duration * 0.7; // Release is portion of total duration
        
        // FILTER MODULATION
        const filterSweepRange = 200 + (valueInEth * 1000); // Higher value = more filter sweep
        const resonanceBoost = Math.min(15, gasPriceGwei / 5); // Gas price affects resonance
        
        // DISTORTION/SATURATION (for aggressive styles)
        const saturationAmount = Math.min(0.7, valueRange * 0.3);
        
        return {
            // Core parameters
            frequency: safeFrequency,
            volume: finalVolume,
            duration,
            valueInEth,
            valueRange,
            
            // Spatial
            pan,
            
            // Effects
            effectsIntensity,
            reverbSend,
            delaySend,
            
            // Harmonic content
            harmonicCount,
            harmonicSpread,
            
            // Envelope
            attack,
            decay,
            sustain,
            release,
            
            // Filter
            filterSweepRange,
            resonanceBoost,
            
            // Distortion
            saturationAmount,
            
            // Flags
            isHighValue,
            isMediumValue,
            
            // Original values
            gasPrice,
            gasPriceGwei
        };
    }
    
    calculateSmartContractParameters(valueInEth, gasPrice, tx, functionSelector, selectorValue) {
        // SMART CONTRACT SPECIFIC AUDIO SYSTEM - Completely different from regular transactions
        
        // Function selector determines base characteristics
        const selectorHue = (selectorValue % 360) / 360; // 0-1 range for HSL
        const selectorComplexity = (selectorValue % 7) + 1; // 1-7 complexity levels
        
        // Base frequency derived from function selector (not pitch-based like regular transactions)
        const baseFreq = 150 + (selectorValue % 600); // 150-750 Hz range
        
        // Multiple frequency layers for complexity
        const frequencies = [
            baseFreq,
            baseFreq * 1.25, // Perfect fourth
            baseFreq * 1.5,  // Perfect fifth  
            baseFreq * 2     // Octave
        ].slice(0, selectorComplexity); // Use more frequencies for complex contracts
        
        // Dramatic volume scaling (smart contracts are more prominent) - REDUCED for ear safety
        const baseVolume = Math.min(0.15, 0.05 + Math.log10(Math.max(valueInEth, 0.001) + 1) * 0.08);
        
        // Longer durations for smart contracts (they're more significant)
        const duration = Math.min(4, 1.2 + valueInEth * 0.8 + (gasPrice / 1e9) * 0.02);
        
        // Function selector determines stereo field behavior
        const pan = Math.sin(selectorValue * 0.01) * 0.8; // -0.8 to 0.8 range, sinusoidal
        
        // Smart contracts get dramatic effects
        const effectsIntensity = 0.7 + (selectorComplexity / 7) * 0.3; // 0.7-1.0 range
        const reverbSend = 0.9; // Heavy reverb for smart contracts
        const delaySend = 0.8;  // Heavy delay for smart contracts
        
        // Modulation characteristics based on function selector
        const modFreq = 1 + (selectorValue % 20); // 1-20 Hz modulation
        const modDepth = 0.3 + (selectorComplexity / 7) * 0.4; // 0.3-0.7 depth
        
        // Envelope with smart contract character
        const attack = 0.05 + (selectorComplexity * 0.02); // Slower attack for complexity
        const decay = duration * 0.3; // Longer decay
        const sustain = 0.6 + (valueInEth * 0.2); // Higher sustain
        const release = duration * 0.5; // Long release
        
        return {
            // Core parameters
            frequencies,
            baseFreq,
            baseVolume,
            duration,
            valueInEth,
            
            // Function selector data
            functionSelector,
            selectorValue,
            selectorHue,
            selectorComplexity,
            
            // Spatial
            pan,
            
            // Effects (more intense than regular transactions)
            effectsIntensity,
            reverbSend,
            delaySend,
            
            // Modulation
            modFreq,
            modDepth,
            
            // Envelope
            attack,
            decay,
            sustain,
            release,
            
            // Original values
            gasPrice,
            tx
        };
    }
    
    playDistinctSmartContract(contractParams, now) {
        // COMPLETELY DISTINCT SMART CONTRACT AUDIO - Multi-layered synthesis
        // This creates a dramatically different sound from regular transactions
        
        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = contractParams.pan;
        
        const masterGain = this.audioContext.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(contractParams.baseVolume, now + contractParams.attack);
        masterGain.gain.exponentialRampToValueAtTime(contractParams.baseVolume * contractParams.sustain, now + contractParams.decay);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + contractParams.duration);
        
        // LAYER 1: Function Selector Drone (deep, continuous tone)
        const drone = this.audioContext.createOscillator();
        const droneGain = this.audioContext.createGain();
        const droneFilter = this.audioContext.createBiquadFilter();
        
        drone.type = 'sawtooth';
        drone.frequency.value = contractParams.baseFreq * 0.5; // Sub-bass
        
        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = contractParams.baseFreq * 2;
        droneFilter.Q.value = 8;
        
        droneGain.gain.value = 0.6;
        
        drone.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(masterGain);
        
        // LAYER 2: Harmonic Stack (function complexity determines layers)
        contractParams.frequencies.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            osc.type = ['sine', 'triangle', 'square', 'sawtooth'][index % 4];
            osc.frequency.setValueAtTime(freq, now);
            
            // Frequency modulation based on function selector
            osc.frequency.linearRampToValueAtTime(freq * (1 + contractParams.modDepth), now + contractParams.duration * 0.3);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + contractParams.duration);
            
            filter.type = 'bandpass';
            filter.frequency.value = freq * 2;
            filter.Q.value = 10 + contractParams.selectorComplexity;
            
            const volume = contractParams.baseVolume / contractParams.frequencies.length * (1 - index * 0.15);
            gain.gain.value = volume;
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now + index * 0.05); // Staggered starts
            osc.stop(now + contractParams.duration);
        });
        
        // LAYER 3: LFO Modulation (creates "smart contract" character)
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        
        lfo.type = 'sine';
        lfo.frequency.value = contractParams.modFreq;
        lfoGain.gain.value = contractParams.baseFreq * contractParams.modDepth;
        
        lfo.connect(lfoGain);
        lfoGain.connect(droneFilter.frequency);
        
        // LAYER 4: Noise burst (represents data/computation)
        const noise = this.audioContext.createBufferSource();
        const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < output.length; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (output.length * 0.3)); // Decaying noise
        }
        noise.buffer = noiseBuffer;
        
        const noiseFilter = this.audioContext.createBiquadFilter();
        const noiseGain = this.audioContext.createGain();
        
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = contractParams.baseFreq * 4;
        noiseFilter.Q.value = 5;
        
        noiseGain.gain.value = contractParams.baseVolume * 0.3;
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        // Audio routing: all layers -> master gain -> panner -> effects
        masterGain.connect(panner);
        panner.connect(this.reverb); // Heavy reverb for smart contracts
        
        // Start everything
        drone.start(now);
        drone.stop(now + contractParams.duration);
        lfo.start(now);
        lfo.stop(now + contractParams.duration);
        noise.start(now + contractParams.attack);
        
        // Add periodic noise bursts during execution
        for (let i = 1; i < contractParams.selectorComplexity; i++) {
            const burstTime = now + (contractParams.duration / contractParams.selectorComplexity) * i;
            setTimeout(() => {
                if (this.audioContext.currentTime < now + contractParams.duration) {
                    const burst = this.audioContext.createBufferSource();
                    burst.buffer = noiseBuffer;
                    burst.connect(noiseFilter);
                    burst.start();
                }
            }, (burstTime - now) * 1000);
        }
    }
}
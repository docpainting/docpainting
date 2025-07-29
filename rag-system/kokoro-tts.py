#!/usr/bin/env python3
"""
Kokoro TTS Integration Script for DOC Painting RAG System
Converts text responses to speech using Kokoro-82M TTS model
"""

import sys
import os
import soundfile as sf
from kokoro import KPipeline

def generate_speech(text, output_file="aria-response.wav"):
    """
    Generate speech from text using Kokoro TTS
    
    Args:
        text (str): Text to convert to speech
        output_file (str): Output audio file path
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"🎙️ Initializing Kokoro TTS pipeline...")
        
        # Initialize Kokoro pipeline for American English
        pipeline = KPipeline(lang_code='a')
        
        # Let Kokoro speak the full response - no truncation
        print(f"📝 Processing full text: {len(text)} characters")
        
        print(f"🔊 Generating speech for: \"{text[:100]}{'...' if len(text) > 100 else ''}\"")
        
        # Generate speech using Kokoro with af_heart voice (natural female voice)
        generator = pipeline(text, voice='af_heart', speed=1.0)
        
        # Process the generator and save audio
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(generator):
            print(f"✅ Generated segment {i+1}: {len(audio)} samples")
            audio_segments.append(audio)
        
        if audio_segments:
            # Concatenate all audio segments
            import numpy as np
            full_audio = np.concatenate(audio_segments)
            
            # Save the audio file
            sf.write(output_file, full_audio, 24000)  # Kokoro uses 24kHz sample rate
            print(f"🎵 Speech saved as: {output_file}")
            print(f"📊 Audio duration: {len(full_audio) / 24000:.2f} seconds")
            return True
        else:
            print("❌ No audio generated")
            return False
            
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return False

def main():
    """Main function to handle command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python kokoro-tts.py text_file.txt [output_file.wav]")
        sys.exit(1)
    
    text_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "aria-response.wav"
    
    # Read text from file to bypass command-line argument length limits
    try:
        with open(text_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        print(f"📖 Read {len(text)} characters from {text_file}")
    except Exception as e:
        print(f"❌ Error reading text file: {e}")
        sys.exit(1)
    
    print(f"🚀 Starting Kokoro TTS for Aria's voice...")
    success = generate_speech(text, output_file)
    
    if success:
        print(f"✅ Aria spoke successfully! Audio saved as {output_file}")
        sys.exit(0)
    else:
        print("❌ Speech generation failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

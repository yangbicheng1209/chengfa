/* Gentle, local Web Audio feedback for the a–z typing game. */
(function (window) {
  'use strict';

  var context = null;
  var master = null;
  var enabled = false;
  var voices = new Set();
  var shortVoices = [];
  var masterVolume = 0.48;
  var pentatonic = [0, 2, 4, 7, 9];

  function hold(parameter, time) {
    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(time);
    } else {
      var value = parameter.value;
      parameter.cancelScheduledValues(time);
      parameter.setValueAtTime(value, time);
    }
  }

  function removeVoice(voice) {
    voices.delete(voice);
    var index = shortVoices.indexOf(voice);
    if (index !== -1) shortVoices.splice(index, 1);
  }

  function quietVoice(voice, time) {
    removeVoice(voice);
    try {
      hold(voice.output.gain, time);
      voice.output.gain.linearRampToValueAtTime(0, time + 0.01);
      voice.oscillators.forEach(function (oscillator) {
        oscillator.stop(time + 0.012);
      });
    } catch (_) {}
  }

  function stop() {
    if (!context || !master) return;
    var time = context.currentTime;
    try {
      hold(master.gain, time);
      master.gain.linearRampToValueAtTime(0, time + 0.01);
    } catch (_) {}
    Array.from(voices).forEach(function (voice) {
      quietVoice(voice, time);
    });
  }

  function restoreVolume() {
    var time = context.currentTime;
    hold(master.gain, time);
    master.gain.linearRampToValueAtTime(masterVolume, time + 0.01);
  }

  function enable() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      if (!context || context.state === 'closed') {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        voices.clear();
        shortVoices = [];
      }
      enabled = true;
      restoreVolume();
      if (context.state !== 'running') {
        var resumed = context.resume();
        if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
      }
      return true;
    } catch (_) {
      enabled = false;
      return false;
    }
  }

  function disable() {
    enabled = false;
    stop();
  }

  function ready() {
    return enabled && context && master && context.state !== 'closed';
  }

  function tone(frequency, start, duration, volume, short, kind) {
    if (!ready()) return;
    var voice;
    try {
      // Only four short feedback tones can exist, including scheduled retry tones.
      if (short) {
        while (shortVoices.length >= 4) quietVoice(shortVoices[0], context.currentTime);
      }
      var output = context.createGain();
      output.gain.value = 1;
      output.connect(master);
      voice = {output: output, oscillators: [], partials: [], kind: kind};
      voices.add(voice);
      if (short) shortVoices.push(voice);

      var partials = [
        {ratio: 1, level: 1, decay: 1},
        {ratio: 2, level: 0.25, decay: 0.65},
        {ratio: 3, level: 0.06, decay: 0.45}
      ];
      var ended = 0;
      partials.forEach(function (partial) {
        var oscillator = context.createOscillator();
        var gain = context.createGain();
        var end = start + duration * partial.decay;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency * partial.ratio, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume * partial.level, start + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        gain.gain.linearRampToValueAtTime(0, end + 0.005);
        oscillator.connect(gain);
        gain.connect(output);
        voice.oscillators.push(oscillator);
        voice.partials.push(gain);
        oscillator.onended = function () {
          try { oscillator.disconnect(); gain.disconnect(); } catch (_) {}
          ended += 1;
          if (ended === partials.length) {
            removeVoice(voice);
            try { output.disconnect(); } catch (_) {}
          }
        };
        oscillator.start(start);
        oscillator.stop(end + 0.006);
      });
    } catch (_) {
      if (voice) quietVoice(voice, context.currentTime);
    }
  }

  function frequency(semitones) {
    return 523.2511306 * Math.pow(2, semitones / 12);
  }

  function cancelKind(kind) {
    Array.from(voices).forEach(function (voice) {
      if (voice.kind === kind) quietVoice(voice, context.currentTime);
    });
  }

  function correct(index) {
    if (!ready()) return;
    try {
      // Replace pending error feedback as soon as typing is correct again.
      cancelKind('retry');
      restoreVolume();
      var position = Math.max(0, Math.floor(Number(index) || 0));
      var note = pentatonic[position % pentatonic.length];
      tone(frequency(note), context.currentTime, 0.145, 0.12, true, 'correct');
    } catch (_) {}
  }

  function retry() {
    if (!ready()) return;
    try {
      // Repeated wrong keys replace this pair; they never add a waiting queue.
      cancelKind('retry');
      restoreVolume();
      var time = context.currentTime;
      tone(392, time, 0.11, 0.075, true, 'retry');
      tone(329.627557, time + 0.09, 0.12, 0.065, true, 'retry');
    } catch (_) {}
  }

  function celebrate(won) {
    if (!ready()) return;
    try {
      stop();
      restoreVolume();
      var time = context.currentTime + 0.015;
      var notes = won ? [0, 4, 7, 12, 16, 12] : [0, 2, 4, 7, 12];
      var spacing = won ? 0.105 : 0.125;
      notes.forEach(function (note, index) {
        var last = index === notes.length - 1;
        tone(frequency(note), time + index * spacing, last ? 0.245 : 0.15,
          last ? 0.14 : 0.115, false, 'celebrate');
      });
    } catch (_) {}
  }

  window.TypingSounds = Object.freeze({
    enable: enable,
    disable: disable,
    stop: stop,
    correct: correct,
    retry: retry,
    celebrate: celebrate
  });
})(window);

'use strict';

/**
 * corpus.js
 *
 * Defines the airport announcement speech corpus — the set of phrases
 * a user records to build their personal voice database.
 *
 * Why these phrases?
 * In limited-domain speech synthesis, engineers carefully design the
 * recording script so that every word or phrase that might ever be
 * needed is represented. Because we are only making airport
 * announcements, a relatively small set of phrases covers the whole
 * domain.
 */

const CORPUS = {
  /**
   * Human-readable descriptions for each category, shown in the UI.
   */
  categories: {
    intro: {
      name: 'Opening Phrases',
      description:
        'These phrases are used to start an announcement and get passengers\u2019 attention.',
      icon: '📣',
    },
    'flight-id': {
      name: 'Flight Numbers',
      description:
        'In aviation, flight numbers are read one digit at a time (e.g., "one zero one" for 101). Record each flight number as a complete phrase.',
      icon: '✈️',
    },
    destination: {
      name: 'Destinations',
      description:
        'These phrases say where each flight is going. Each destination is a separate recording unit.',
      icon: '🗺️',
    },
    status: {
      name: 'Flight Status',
      description:
        'These phrases describe what is happening with the flight — whether it is boarding, delayed, or cancelled.',
      icon: '📋',
    },
    gate: {
      name: 'Gate Numbers',
      description:
        'These phrases tell passengers which gate to go to. Gate numbers are spoken as words (e.g., "gate five").',
      icon: '🚪',
    },
    delay: {
      name: 'Delay Duration',
      description:
        'When a flight is delayed, these phrases say how long the delay is.',
      icon: '⏱️',
    },
    instruction: {
      name: 'Passenger Instructions',
      description:
        'Directions telling passengers what to do or reminders about the boarding process.',
      icon: '📢',
    },
    closing: {
      name: 'Closing Phrases',
      description:
        'Polite phrases used to end an announcement, thank passengers, or apologise for inconvenience.',
      icon: '🙏',
    },
  },

  /**
   * The individual speech units.
   *
   * Each unit has:
   *   id          – unique identifier used as the database key
   *   text        – the normalised, lower-case text the system matches
   *                 against (what the user should say, without capitals)
   *   displayText – how the text appears on screen to the user
   *   category    – groups units together visually
   *   description – plain-language explanation shown to the student
   *   required    – if true, the unit is needed for the example announcements
   */
  units: [
    // ── Opening phrases ──────────────────────────────────────────────
    {
      id: 'intro-attention',
      text: 'attention',
      displayText: 'Attention',
      category: 'intro',
      description: 'A single word to open any announcement.',
      required: false,
    },
    {
      id: 'intro-attention-all',
      text: 'attention all passengers',
      displayText: 'Attention all passengers',
      category: 'intro',
      description: 'The most common way to begin an airport announcement.',
      required: true,
    },
    {
      id: 'intro-ladies',
      text: 'ladies and gentlemen',
      displayText: 'Ladies and gentlemen',
      category: 'intro',
      description: 'A more formal opening.',
      required: false,
    },

    // ── Flight numbers ────────────────────────────────────────────────
    {
      id: 'flight-101',
      text: 'flight one zero one',
      displayText: 'Flight one zero one (Flight 101)',
      category: 'flight-id',
      description: 'Flight number 101. In aviation, each digit is spoken separately.',
      required: true,
    },
    {
      id: 'flight-202',
      text: 'flight two zero two',
      displayText: 'Flight two zero two (Flight 202)',
      category: 'flight-id',
      description: 'Flight number 202.',
      required: true,
    },
    {
      id: 'flight-303',
      text: 'flight three zero three',
      displayText: 'Flight three zero three (Flight 303)',
      category: 'flight-id',
      description: 'Flight number 303.',
      required: false,
    },
    {
      id: 'flight-404',
      text: 'flight four zero four',
      displayText: 'Flight four zero four (Flight 404)',
      category: 'flight-id',
      description: 'Flight number 404.',
      required: false,
    },
    {
      id: 'flight-505',
      text: 'flight five zero five',
      displayText: 'Flight five zero five (Flight 505)',
      category: 'flight-id',
      description: 'Flight number 505.',
      required: false,
    },

    // ── Destinations ──────────────────────────────────────────────────
    {
      id: 'dest-newyork',
      text: 'to new york',
      displayText: 'to New York',
      category: 'destination',
      description: 'The phrase used when a flight is heading to New York.',
      required: true,
    },
    {
      id: 'dest-losangeles',
      text: 'to los angeles',
      displayText: 'to Los Angeles',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Los Angeles.',
      required: true,
    },
    {
      id: 'dest-chicago',
      text: 'to chicago',
      displayText: 'to Chicago',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Chicago.',
      required: false,
    },
    {
      id: 'dest-miami',
      text: 'to miami',
      displayText: 'to Miami',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Miami.',
      required: false,
    },
    {
      id: 'dest-dallas',
      text: 'to dallas',
      displayText: 'to Dallas',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Dallas.',
      required: false,
    },
    {
      id: 'dest-seattle',
      text: 'to seattle',
      displayText: 'to Seattle',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Seattle.',
      required: false,
    },
    {
      id: 'dest-boston',
      text: 'to boston',
      displayText: 'to Boston',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Boston.',
      required: false,
    },
    {
      id: 'dest-denver',
      text: 'to denver',
      displayText: 'to Denver',
      category: 'destination',
      description: 'The phrase used when a flight is heading to Denver.',
      required: false,
    },

    // ── Flight status ─────────────────────────────────────────────────
    {
      id: 'status-boarding',
      text: 'is now boarding',
      displayText: 'is now boarding',
      category: 'status',
      description: 'Passengers are invited to board the aircraft.',
      required: true,
    },
    {
      id: 'status-departing',
      text: 'is now departing',
      displayText: 'is now departing',
      category: 'status',
      description: 'The flight is leaving right now.',
      required: false,
    },
    {
      id: 'status-delayed',
      text: 'has been delayed',
      displayText: 'has been delayed',
      category: 'status',
      description: 'The flight will leave later than originally scheduled.',
      required: true,
    },
    {
      id: 'status-cancelled',
      text: 'has been cancelled',
      displayText: 'has been cancelled',
      category: 'status',
      description: 'The flight will not operate today.',
      required: false,
    },
    {
      id: 'status-ontime',
      text: 'will depart on time',
      displayText: 'will depart on time',
      category: 'status',
      description: 'The flight is running to its original schedule.',
      required: false,
    },
    {
      id: 'status-final',
      text: 'is on final boarding call',
      displayText: 'is on final boarding call',
      category: 'status',
      description: 'This is the last chance for passengers to board.',
      required: false,
    },

    // ── Gate numbers ──────────────────────────────────────────────────
    {
      id: 'gate-1',
      text: 'at gate one',
      displayText: 'at gate one',
      category: 'gate',
      description: 'Gate 1.',
      required: false,
    },
    {
      id: 'gate-2',
      text: 'at gate two',
      displayText: 'at gate two',
      category: 'gate',
      description: 'Gate 2.',
      required: false,
    },
    {
      id: 'gate-3',
      text: 'at gate three',
      displayText: 'at gate three',
      category: 'gate',
      description: 'Gate 3.',
      required: false,
    },
    {
      id: 'gate-4',
      text: 'at gate four',
      displayText: 'at gate four',
      category: 'gate',
      description: 'Gate 4.',
      required: false,
    },
    {
      id: 'gate-5',
      text: 'at gate five',
      displayText: 'at gate five',
      category: 'gate',
      description: 'Gate 5.',
      required: true,
    },
    {
      id: 'gate-6',
      text: 'at gate six',
      displayText: 'at gate six',
      category: 'gate',
      description: 'Gate 6.',
      required: false,
    },
    {
      id: 'gate-7',
      text: 'at gate seven',
      displayText: 'at gate seven',
      category: 'gate',
      description: 'Gate 7.',
      required: false,
    },
    {
      id: 'gate-8',
      text: 'at gate eight',
      displayText: 'at gate eight',
      category: 'gate',
      description: 'Gate 8.',
      required: false,
    },
    {
      id: 'gate-9',
      text: 'at gate nine',
      displayText: 'at gate nine',
      category: 'gate',
      description: 'Gate 9.',
      required: false,
    },
    {
      id: 'gate-10',
      text: 'at gate ten',
      displayText: 'at gate ten',
      category: 'gate',
      description: 'Gate 10.',
      required: false,
    },

    // ── Delay durations ───────────────────────────────────────────────
    {
      id: 'delay-30',
      text: 'by thirty minutes',
      displayText: 'by thirty minutes',
      category: 'delay',
      description: 'A 30-minute delay.',
      required: true,
    },
    {
      id: 'delay-1h',
      text: 'by one hour',
      displayText: 'by one hour',
      category: 'delay',
      description: 'A one-hour delay.',
      required: false,
    },
    {
      id: 'delay-2h',
      text: 'by two hours',
      displayText: 'by two hours',
      category: 'delay',
      description: 'A two-hour delay.',
      required: false,
    },

    // ── Passenger instructions ────────────────────────────────────────
    {
      id: 'inst-proceed',
      text: 'please proceed to the gate',
      displayText: 'please proceed to the gate',
      category: 'instruction',
      description: 'Asking passengers to move to their departure gate.',
      required: false,
    },
    {
      id: 'inst-final',
      text: 'this is the final boarding call',
      displayText: 'this is the final boarding call',
      category: 'instruction',
      description: 'Last call for passengers to board.',
      required: false,
    },
    {
      id: 'inst-pass',
      text: 'please have your boarding pass ready',
      displayText: 'please have your boarding pass ready',
      category: 'instruction',
      description: 'Reminding passengers to prepare their boarding pass.',
      required: false,
    },

    // ── Closing phrases ───────────────────────────────────────────────
    {
      id: 'close-thanks',
      text: 'thank you for your patience',
      displayText: 'thank you for your patience',
      category: 'closing',
      description: 'A polite closing, often used after announcing a delay.',
      required: true,
    },
    {
      id: 'close-sorry',
      text: 'we apologize for the inconvenience',
      displayText: 'we apologize for the inconvenience',
      category: 'closing',
      description: 'An apology to passengers, typically for delays or cancellations.',
      required: false,
    },
    {
      id: 'close-flying',
      text: 'thank you for flying with us',
      displayText: 'thank you for flying with us',
      category: 'closing',
      description: 'A friendly closing phrase.',
      required: false,
    },
    {
      id: 'close-pleasant',
      text: 'have a pleasant flight',
      displayText: 'have a pleasant flight',
      category: 'closing',
      description: 'A warm send-off for departing passengers.',
      required: false,
    },
  ],

  /**
   * Ready-made example announcements for the synthesis step.
   * Each example shows what can be built from the corpus units.
   */
  examples: [
    {
      label: 'Boarding announcement',
      text: 'Attention all passengers. Flight 101 to New York is now boarding at gate 5.',
    },
    {
      label: 'Delay announcement',
      text: 'Attention all passengers. Flight 202 to Los Angeles has been delayed by thirty minutes. We apologize for the inconvenience.',
    },
    {
      label: 'Final boarding call',
      text: 'Flight 101 to New York is on final boarding call at gate 5. This is the final boarding call.',
    },
    {
      label: 'Delay with patience',
      text: 'Attention all passengers. Flight 202 to Los Angeles has been delayed by thirty minutes. Thank you for your patience.',
    },
  ],
};

// Expose globally (no module bundler needed for GitHub Pages)
if (typeof window !== 'undefined') {
  window.CORPUS = CORPUS;
}

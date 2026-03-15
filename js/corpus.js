'use strict';

/**
 * corpus.js
 *
 * Defines the recording corpus: 15 complete airport announcement sentences.
 *
 * WHY FULL SENTENCES?
 * In real limited-domain speech synthesis, engineers record COMPLETE
 * sentences, not isolated words or fragments.  This is because human
 * speech sounds natural only when words are spoken in context — the same
 * word sounds slightly different at the start of a sentence vs. the middle.
 * Pronunciation, pitch, and rhythm all change depending on context.
 * Recording isolated fragments produces choppy, robotic-sounding output.
 *
 * HOW ARE THE SENTENCES DESIGNED?
 * The corpus is designed so that every word or phrase that might ever
 * appear in a new announcement is represented in at least ONE sentence.
 * The 15 sentences together cover all flight numbers, destinations, gate
 * numbers, statuses, and closings needed for typical airport announcements.
 *
 * HOW DOES THE SYSTEM EXTRACT SHORT UNITS FROM FULL SENTENCES?
 * After recording, the system uses a technique called silence detection
 * (Voice Activity Detection, or VAD) to find the natural pauses between
 * phrases in your recording.  Each silence gap is used as a boundary,
 * splitting the sentence into phrase-level "units" that can later be
 * recombined.  If the automatic detection fails, the system falls back to
 * splitting the audio proportionally based on character counts.
 *
 * Each sentence definition below includes a `segments` array that lists
 * the phrase units (with their expected text) in the order they appear.
 * This lets the system know how many segments to look for and what text
 * each one corresponds to.
 */

const CORPUS = {

  /**
   * Canonical phrase-unit definitions.
   * Key   = unitId (used as the database key and for synthesis matching)
   * Value = the normalised lower-case text the synthesis algorithm matches
   */
  unitDefs: {
    // Opening phrases
    'intro-attention-all':  'attention all passengers',
    'intro-ladies':         'ladies and gentlemen',
    'intro-final-call':     'this is the final boarding call',
    'intro-attention':      'attention',

    // Flight numbers (aviation style: digit-by-digit)
    'flight-101': 'flight one zero one',
    'flight-202': 'flight two zero two',
    'flight-303': 'flight three zero three',
    'flight-404': 'flight four zero four',
    'flight-505': 'flight five zero five',

    // Destinations
    'dest-newyork':    'to new york',
    'dest-losangeles': 'to los angeles',
    'dest-chicago':    'to chicago',
    'dest-miami':      'to miami',
    'dest-dallas':     'to dallas',
    'dest-seattle':    'to seattle',
    'dest-boston':     'to boston',
    'dest-denver':     'to denver',

    // Flight status
    'status-boarding':  'is now boarding',
    'status-departing': 'is now departing',
    'status-delayed':   'has been delayed',
    'status-cancelled': 'has been cancelled',
    'status-ontime':    'will depart on time',
    'status-final':     'is on final boarding call',

    // Gate numbers
    'gate-1':  'at gate one',
    'gate-2':  'at gate two',
    'gate-3':  'at gate three',
    'gate-4':  'at gate four',
    'gate-5':  'at gate five',
    'gate-6':  'at gate six',
    'gate-7':  'at gate seven',
    'gate-8':  'at gate eight',
    'gate-9':  'at gate nine',
    'gate-10': 'at gate ten',

    // Delay durations
    'delay-30': 'by thirty minutes',
    'delay-1h': 'by one hour',
    'delay-2h': 'by two hours',

    // Instructions
    'inst-proceed': 'please proceed to the gate immediately',
    'inst-pass':    'please have your boarding pass ready',

    // Closing phrases
    'close-thanks':  'thank you for your patience',
    'close-sorry':   'we apologize for the inconvenience',
    'close-flying':  'thank you for flying with us',
    'close-pleasant':'have a pleasant flight',
  },

  /**
   * The 15 sentences students will record.
   *
   * Each sentence has a `segments` array listing the phrase units it
   * contains, in order.  Each segment has:
   *   unitId  – key into unitDefs above
   *   text    – the text the student says for this segment
   *             (used for character-count proportional segmentation)
   */
  sentences: [
    // ── Boarding announcements ─────────────────────────────────────
    {
      id: 'sent-01',
      title: 'Boarding — Flight 101 to New York, gate 5',
      category: 'boarding',
      description: 'Covers the standard boarding opening, flight 101, New York, and gate 5.',
      text: 'Attention all passengers, flight one zero one to New York is now boarding at gate five.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers' },
        { unitId: 'flight-101',          text: 'flight one zero one'      },
        { unitId: 'dest-newyork',        text: 'to New York'              },
        { unitId: 'status-boarding',     text: 'is now boarding'          },
        { unitId: 'gate-5',              text: 'at gate five'             },
      ],
    },
    {
      id: 'sent-02',
      title: 'Boarding — Flight 202 to Los Angeles, gate 3',
      category: 'boarding',
      description: 'Adds flight 202, Los Angeles, and gate 3.',
      text: 'Attention all passengers, flight two zero two to Los Angeles is now boarding at gate three.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers' },
        { unitId: 'flight-202',          text: 'flight two zero two'      },
        { unitId: 'dest-losangeles',     text: 'to Los Angeles'           },
        { unitId: 'status-boarding',     text: 'is now boarding'          },
        { unitId: 'gate-3',              text: 'at gate three'            },
      ],
    },
    {
      id: 'sent-03',
      title: 'Boarding — Flight 303 to Chicago, gate 7',
      category: 'boarding',
      description: 'Adds flight 303, Chicago, and gate 7.',
      text: 'Attention all passengers, flight three zero three to Chicago is now boarding at gate seven.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers' },
        { unitId: 'flight-303',          text: 'flight three zero three'  },
        { unitId: 'dest-chicago',        text: 'to Chicago'               },
        { unitId: 'status-boarding',     text: 'is now boarding'          },
        { unitId: 'gate-7',              text: 'at gate seven'            },
      ],
    },
    {
      id: 'sent-04',
      title: 'Boarding (formal) — Flight 404 to Miami',
      category: 'boarding',
      description: 'Uses the formal "Ladies and gentlemen" opening, adds Miami and a boarding-pass reminder.',
      text: 'Ladies and gentlemen, flight four zero four to Miami is now boarding. Please have your boarding pass ready.',
      segments: [
        { unitId: 'intro-ladies',    text: 'Ladies and gentlemen'            },
        { unitId: 'flight-404',      text: 'flight four zero four'           },
        { unitId: 'dest-miami',      text: 'to Miami'                        },
        { unitId: 'status-boarding', text: 'is now boarding'                 },
        { unitId: 'inst-pass',       text: 'Please have your boarding pass ready' },
      ],
    },
    {
      id: 'sent-05',
      title: 'Boarding — Flight 505 to Dallas, gate 10',
      category: 'boarding',
      description: 'Adds flight 505, Dallas, and gate 10.',
      text: 'Attention all passengers, flight five zero five to Dallas is now boarding at gate ten.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers' },
        { unitId: 'flight-505',          text: 'flight five zero five'    },
        { unitId: 'dest-dallas',         text: 'to Dallas'                },
        { unitId: 'status-boarding',     text: 'is now boarding'          },
        { unitId: 'gate-10',             text: 'at gate ten'              },
      ],
    },

    // ── Delay announcements ────────────────────────────────────────
    {
      id: 'sent-06',
      title: 'Delay — Flight 101, 30 minutes',
      category: 'delay',
      description: 'Covers a 30-minute delay with a thank-you closing.',
      text: 'Attention all passengers, flight one zero one to New York has been delayed by thirty minutes. Thank you for your patience.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'   },
        { unitId: 'flight-101',          text: 'flight one zero one'        },
        { unitId: 'dest-newyork',        text: 'to New York'                },
        { unitId: 'status-delayed',      text: 'has been delayed'           },
        { unitId: 'delay-30',            text: 'by thirty minutes'          },
        { unitId: 'close-thanks',        text: 'Thank you for your patience'},
      ],
    },
    {
      id: 'sent-07',
      title: 'Delay — Flight 202, 1 hour, apology',
      category: 'delay',
      description: 'Covers a one-hour delay with an apology closing.',
      text: 'Ladies and gentlemen, flight two zero two to Los Angeles has been delayed by one hour. We apologize for the inconvenience.',
      segments: [
        { unitId: 'intro-ladies',    text: 'Ladies and gentlemen'                  },
        { unitId: 'flight-202',      text: 'flight two zero two'                   },
        { unitId: 'dest-losangeles', text: 'to Los Angeles'                        },
        { unitId: 'status-delayed',  text: 'has been delayed'                      },
        { unitId: 'delay-1h',        text: 'by one hour'                           },
        { unitId: 'close-sorry',     text: 'We apologize for the inconvenience'    },
      ],
    },
    {
      id: 'sent-08',
      title: 'Delay — Flight 303, 2 hours',
      category: 'delay',
      description: 'Covers a two-hour delay.',
      text: 'Attention all passengers, flight three zero three to Chicago has been delayed by two hours. We apologize for the inconvenience.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'           },
        { unitId: 'flight-303',          text: 'flight three zero three'            },
        { unitId: 'dest-chicago',        text: 'to Chicago'                         },
        { unitId: 'status-delayed',      text: 'has been delayed'                   },
        { unitId: 'delay-2h',            text: 'by two hours'                       },
        { unitId: 'close-sorry',         text: 'We apologize for the inconvenience' },
      ],
    },
    {
      id: 'sent-09',
      title: 'Cancellation — Flight 404 to Miami',
      category: 'cancellation',
      description: 'Covers a cancellation with both apology and patience closings.',
      text: 'Attention all passengers, flight four zero four to Miami has been cancelled. We apologize for the inconvenience.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'           },
        { unitId: 'flight-404',          text: 'flight four zero four'              },
        { unitId: 'dest-miami',          text: 'to Miami'                           },
        { unitId: 'status-cancelled',    text: 'has been cancelled'                 },
        { unitId: 'close-sorry',         text: 'We apologize for the inconvenience' },
      ],
    },

    // ── Final boarding calls ───────────────────────────────────────
    {
      id: 'sent-10',
      title: 'Final boarding call — Flight 505 to Dallas',
      category: 'final-call',
      description: 'The urgent final boarding call format.',
      text: 'This is the final boarding call for flight five zero five to Dallas at gate ten. Please proceed to the gate immediately.',
      segments: [
        { unitId: 'intro-final-call', text: 'This is the final boarding call for' },
        { unitId: 'flight-505',       text: 'flight five zero five'               },
        { unitId: 'dest-dallas',      text: 'to Dallas'                           },
        { unitId: 'gate-10',          text: 'at gate ten'                         },
        { unitId: 'inst-proceed',     text: 'Please proceed to the gate immediately' },
      ],
    },
    {
      id: 'sent-11',
      title: 'Final boarding call — Flight 101 to New York',
      category: 'final-call',
      description: 'Formal final boarding call using "Ladies and gentlemen".',
      text: 'Ladies and gentlemen, flight one zero one to New York is on final boarding call at gate five.',
      segments: [
        { unitId: 'intro-ladies',  text: 'Ladies and gentlemen'           },
        { unitId: 'flight-101',    text: 'flight one zero one'            },
        { unitId: 'dest-newyork',  text: 'to New York'                   },
        { unitId: 'status-final',  text: 'is on final boarding call'     },
        { unitId: 'gate-5',        text: 'at gate five'                  },
      ],
    },

    // ── Departure / on-time ────────────────────────────────────────
    {
      id: 'sent-12',
      title: 'Departing — Flight 202 from gate 3',
      category: 'departure',
      description: 'Covers "now departing" and a pleasant-flight closing.',
      text: 'Attention all passengers, flight two zero two to Los Angeles is now departing from gate three. Have a pleasant flight.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'  },
        { unitId: 'flight-202',          text: 'flight two zero two'       },
        { unitId: 'dest-losangeles',     text: 'to Los Angeles'            },
        { unitId: 'status-departing',    text: 'is now departing from'     },
        { unitId: 'gate-3',              text: 'gate three'                },
        { unitId: 'close-pleasant',      text: 'Have a pleasant flight'    },
      ],
    },
    {
      id: 'sent-13',
      title: 'On time — Flight 303 to Seattle',
      category: 'departure',
      description: 'Covers the on-time status message and introduces Seattle.',
      text: 'Attention all passengers, flight three zero three to Seattle will depart on time from gate seven.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'  },
        { unitId: 'flight-303',          text: 'flight three zero three'   },
        { unitId: 'dest-seattle',        text: 'to Seattle'                },
        { unitId: 'status-ontime',       text: 'will depart on time'       },
        { unitId: 'gate-7',              text: 'from gate seven'           },
      ],
    },
    {
      id: 'sent-14',
      title: 'Boarding — Flight 404 to Boston, gate 8',
      category: 'boarding',
      description: 'Introduces Boston as a destination and gate 8.',
      text: 'Attention all passengers, flight four zero four to Boston is now boarding at gate eight.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers' },
        { unitId: 'flight-404',          text: 'flight four zero four'    },
        { unitId: 'dest-boston',         text: 'to Boston'                },
        { unitId: 'status-boarding',     text: 'is now boarding'          },
        { unitId: 'gate-8',              text: 'at gate eight'            },
      ],
    },
    {
      id: 'sent-15',
      title: 'Delay — Flight 505 to Denver, 30 minutes',
      category: 'delay',
      description: 'Introduces Denver. A second 30-minute delay recording for better selection.',
      text: 'Attention all passengers, flight five zero five to Denver has been delayed by thirty minutes. Thank you for your patience.',
      segments: [
        { unitId: 'intro-attention-all', text: 'Attention all passengers'    },
        { unitId: 'flight-505',          text: 'flight five zero five'       },
        { unitId: 'dest-denver',         text: 'to Denver'                   },
        { unitId: 'status-delayed',      text: 'has been delayed'            },
        { unitId: 'delay-30',            text: 'by thirty minutes'           },
        { unitId: 'close-thanks',        text: 'Thank you for your patience' },
      ],
    },
  ],

  /**
   * Human-readable labels for sentence categories.
   */
  categories: {
    boarding:     { name: 'Boarding Announcements', icon: '✈️',  description: 'Inviting passengers to board.' },
    delay:        { name: 'Delay Announcements',    icon: '⏱️',  description: 'Flight is running late.' },
    cancellation: { name: 'Cancellations',          icon: '❌',  description: 'Flight will not operate today.' },
    'final-call': { name: 'Final Boarding Calls',   icon: '🔔',  description: 'Last chance to board.' },
    departure:    { name: 'Departure / On-time',    icon: '🛫',  description: 'Flight is leaving or on schedule.' },
  },

  /**
   * Example announcements for the synthesis step.
   */
  examples: [
    {
      label: 'Boarding',
      text: 'Attention all passengers, flight one zero one to New York is now boarding at gate five.',
    },
    {
      label: 'Delay + apology',
      text: 'Attention all passengers, flight two zero two to Los Angeles has been delayed by thirty minutes. We apologize for the inconvenience.',
    },
    {
      label: 'Final boarding call',
      text: 'This is the final boarding call for flight three zero three to Chicago at gate seven. Please proceed to the gate immediately.',
    },
    {
      label: 'Cancellation',
      text: 'Ladies and gentlemen, flight four zero four to Miami has been cancelled. We apologize for the inconvenience.',
    },
    {
      label: 'On time',
      text: 'Attention all passengers, flight five zero five to Dallas will depart on time from gate ten. Have a pleasant flight.',
    },
  ],
};

if (typeof window !== 'undefined') {
  window.CORPUS = CORPUS;
}

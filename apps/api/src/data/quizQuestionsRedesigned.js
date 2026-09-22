/**
 * REDESIGNED QUIZ QUESTIONS
 * 
 * Key Changes:
 * - Increased from 12 to 16 questions for better trait span
 * - Trait values more carefully distributed (-2, -1, 0, 1, 2)
 * - Better coverage of all trait combinations
 * - Replaced 'independence' with 'stranger_friendly'
 * - Questions target specific trait dimensions
 */

export function getRedesignedQuizQuestions() {
  return [
    // ENERGY DIMENSION (Q1-Q3)
    {
      id: "q1",
      text: "How do you prefer to spend most of your time?",
      type: "single",
      options: [
        {
          value: "calm_indoor",
          label: "Calm, indoors with quiet activities",
          traits: { energy: -2, sociability: 0, stranger_friendly: 0, routine: 1, trainability: 0 }
        },
        {
          value: "moderate_mix",
          label: "Mix of activity and relaxation",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "active_outdoor",
          label: "Very active, lots of outdoor time",
          traits: { energy: 2, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        }
      ]
    },

    // SOCIABILITY DIMENSION (Q2-Q4)
    {
      id: "q2",
      text: "How do you feel about spending time with others?",
      type: "single",
      options: [
        {
          value: "prefer_alone",
          label: "I prefer time alone or with close people",
          traits: { energy: 0, sociability: -2, stranger_friendly: -2, routine: 1, trainability: 0 }
        },
        {
          value: "selective",
          label: "Selective about who I spend time with",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "very_social",
          label: "I love being around people and making new friends",
          traits: { energy: 1, sociability: 2, stranger_friendly: 2, routine: 0, trainability: 0 }
        }
      ]
    },

    // STRANGER FRIENDLINESS (Q3-Q5)
    {
      id: "q3",
      text: "How do you typically react to meeting new people?",
      type: "single",
      options: [
        {
          value: "reserved",
          label: "Reserved, takes time to warm up",
          traits: { energy: -1, sociability: -1, stranger_friendly: -2, routine: 1, trainability: 0 }
        },
        {
          value: "gradual",
          label: "Friendly once I get to know them",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "immediately_friendly",
          label: "Instantly welcoming and friendly",
          traits: { energy: 1, sociability: 1, stranger_friendly: 2, routine: 0, trainability: 1 }
        }
      ]
    },

    // ROUTINE/ADAPTABILITY (Q4-Q6)
    {
      id: "q4",
      text: "How do you handle change and unexpected situations?",
      type: "single",
      options: [
        {
          value: "need_structure",
          label: "I need structure and predictability",
          traits: { energy: -1, sociability: 0, stranger_friendly: 0, routine: 2, trainability: 1 }
        },
        {
          value: "flexible",
          label: "I adapt well to changes",
          traits: { energy: 0, sociability: 1, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "thrive_spontaneous",
          label: "I thrive on spontaneity and change",
          traits: { energy: 1, sociability: 1, stranger_friendly: 1, routine: -2, trainability: -1 }
        }
      ]
    },

    // TRAINABILITY (Q5-Q7)
    {
      id: "q5",
      text: "How do you approach learning and following guidance?",
      type: "single",
      options: [
        {
          value: "independent_learner",
          label: "I like figuring things out myself",
          traits: { energy: 0, sociability: -1, stranger_friendly: 0, routine: -1, trainability: -2 }
        },
        {
          value: "collaborative",
          label: "I appreciate guidance and collaboration",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 1, trainability: 1 }
        },
        {
          value: "follow_rules",
          label: "I'm eager to learn and follow structure",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 2, trainability: 2 }
        }
      ]
    },

    // LIFESTYLE: Sleep & Rest (Q6)
    {
      id: "q6",
      text: "What's your ideal sleep and rest schedule?",
      type: "single",
      options: [
        {
          value: "lots_rest",
          label: "I love sleeping and resting frequently",
          traits: { energy: -2, sociability: 0, stranger_friendly: -1, routine: 1, trainability: 0 }
        },
        {
          value: "moderate_rest",
          label: "Moderate, balanced sleep",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "minimal_sleep",
          label: "I'm fine with minimal sleep, always on the go",
          traits: { energy: 2, sociability: 1, stranger_friendly: 1, routine: -1, trainability: 1 }
        }
      ]
    },

    // NOISE TOLERANCE (Q7)
    {
      id: "q7",
      text: "How do you feel about noise and stimulation?",
      type: "single",
      options: [
        {
          value: "quiet_needed",
          label: "I need quiet, prefer peaceful environments",
          traits: { energy: -1, sociability: -1, stranger_friendly: -1, routine: 1, trainability: 0 }
        },
        {
          value: "some_noise_ok",
          label: "Some noise is fine, I'm adaptable",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "love_stimulation",
          label: "I love excitement and lots of activity around me",
          traits: { energy: 2, sociability: 2, stranger_friendly: 1, routine: -1, trainability: 0 }
        }
      ]
    },

    // PERSONAL SPACE (Q8)
    {
      id: "q8",
      text: "How important is personal space to you?",
      type: "single",
      options: [
        {
          value: "need_space",
          label: "I value my personal space highly",
          traits: { energy: -1, sociability: -2, stranger_friendly: -2, routine: 1, trainability: 0 }
        },
        {
          value: "moderate_space",
          label: "Some space, but I enjoy closeness",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "no_space_needed",
          label: "The more companionship, the better",
          traits: { energy: 1, sociability: 2, stranger_friendly: 2, routine: 1, trainability: 1 }
        }
      ]
    },

    // FOOD & CARE PREFERENCES (Q9)
    {
      id: "q9",
      text: "How do you prefer to handle routines and maintenance?",
      type: "single",
      options: [
        {
          value: "minimal_effort",
          label: "I prefer minimal, low-maintenance routines",
          traits: { energy: -1, sociability: 0, stranger_friendly: 0, routine: -1, trainability: -1 }
        },
        {
          value: "regular_routine",
          label: "Regular, predictable routines work well for me",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 2, trainability: 1 }
        },
        {
          value: "detailed_care",
          label: "I enjoy detailed care routines and preparation",
          traits: { energy: 0, sociability: 1, stranger_friendly: 0, routine: 2, trainability: 2 }
        }
      ]
    },

    // RESPONSIBILITY & COMMITMENT (Q10)
    {
      id: "q10",
      text: "How do you approach commitment and responsibility?",
      type: "single",
      options: [
        {
          value: "casual",
          label: "I prefer keeping things casual and loose",
          traits: { energy: 1, sociability: 0, stranger_friendly: 0, routine: -2, trainability: -2 }
        },
        {
          value: "balanced",
          label: "I balance commitment with flexibility",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 1, trainability: 1 }
        },
        {
          value: "deeply_committed",
          label: "I'm deeply committed and reliable",
          traits: { energy: 0, sociability: 1, stranger_friendly: 1, routine: 2, trainability: 2 }
        }
      ]
    },

    // FEAR & ANXIETY (Q11)
    {
      id: "q11",
      text: "How do you handle fear and uncertainty?",
      type: "single",
      options: [
        {
          value: "anxious",
          label: "I tend to be anxious in unfamiliar situations",
          traits: { energy: -1, sociability: -1, stranger_friendly: -1, routine: 1, trainability: 0 }
        },
        {
          value: "cautious",
          label: "I'm cautious but can adjust",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "fearless",
          label: "I'm confident and fearless in new situations",
          traits: { energy: 1, sociability: 1, stranger_friendly: 2, routine: -1, trainability: 1 }
        }
      ]
    },

    // INDEPENDENCE (Q12)
    {
      id: "q12",
      text: "How do you prefer to work: alone or with others?",
      type: "single",
      options: [
        {
          value: "solo",
          label: "I prefer working independently",
          traits: { energy: -1, sociability: -1, stranger_friendly: -1, routine: 0, trainability: 0 }
        },
        {
          value: "both",
          label: "I'm comfortable with both solo and team settings",
          traits: { energy: 0, sociability: 1, stranger_friendly: 1, routine: 0, trainability: 1 }
        },
        {
          value: "team",
          label: "I thrive best with constant interaction",
          traits: { energy: 1, sociability: 2, stranger_friendly: 2, routine: 1, trainability: 0 }
        }
      ]
    },

    // EMOTIONAL EXPRESSION (Q13)
    {
      id: "q13",
      text: "How emotionally expressive are you?",
      type: "single",
      options: [
        {
          value: "reserved",
          label: "I keep my emotions to myself",
          traits: { energy: -1, sociability: -1, stranger_friendly: -2, routine: 1, trainability: 0 }
        },
        {
          value: "moderate",
          label: "I show emotion when appropriate",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "expressive",
          label: "I'm openly affectionate and expressive",
          traits: { energy: 1, sociability: 2, stranger_friendly: 2, routine: 0, trainability: 1 }
        }
      ]
    },

    // OUTDOOR VS INDOOR (Q14)
    {
      id: "q14",
      text: "What environment do you prefer?",
      type: "single",
      options: [
        {
          value: "indoor",
          label: "I'm an indoor person",
          traits: { energy: -1, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 0 }
        },
        {
          value: "both",
          label: "I enjoy both indoor and outdoor equally",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 1, trainability: 1 }
        },
        {
          value: "outdoor",
          label: "I love being outdoors and exploring",
          traits: { energy: 2, sociability: 1, stranger_friendly: 1, routine: -1, trainability: 0 }
        }
      ]
    },

    // PATIENCE & TOLERANCE (Q15)
    {
      id: "q15",
      text: "How patient are you with difficult situations?",
      type: "single",
      options: [
        {
          value: "impatient",
          label: "I get frustrated quickly",
          traits: { energy: 1, sociability: -1, stranger_friendly: -1, routine: -1, trainability: -2 }
        },
        {
          value: "average",
          label: "I'm reasonably patient",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "very_patient",
          label: "I'm very patient and tolerant",
          traits: { energy: -1, sociability: 1, stranger_friendly: 1, routine: 1, trainability: 2 }
        }
      ]
    },

    // PLAY & CURIOSITY (Q16)
    {
      id: "q16",
      text: "How playful and curious are you?",
      type: "single",
      options: [
        {
          value: "serious",
          label: "I'm more serious and reserved",
          traits: { energy: -1, sociability: -1, stranger_friendly: -1, routine: 1, trainability: 0 }
        },
        {
          value: "balanced",
          label: "Moderate playfulness and curiosity",
          traits: { energy: 0, sociability: 0, stranger_friendly: 0, routine: 0, trainability: 1 }
        },
        {
          value: "playful",
          label: "Very playful, curious, and adventurous",
          traits: { energy: 2, sociability: 1, stranger_friendly: 1, routine: -1, trainability: 1 }
        }
      ]
    }
  ];
}

export default getRedesignedQuizQuestions();

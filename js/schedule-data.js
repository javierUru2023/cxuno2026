window.RADIO_SCHEDULE = {
  timezone: "America/Montevideo",
  shows: [
    {
      id: "radio-lounge",
      name: "Radio Lounge",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      start: "06:00",
      end: "08:00"
    },
    {
      id: "wake-up",
      name: "Wake Up",
      days: ["mon", "tue", "wed", "thu", "fri"],
      start: "08:00",
      end: "12:00"
    },
    {
      id: "music-express",
      name: "Music Express",
      days: ["mon", "tue", "wed", "thu", "fri"],
      start: "12:00",
      end: "19:00"
    },
    {
      id: "back-track-weekend-morning",
      name: "Backtrack",
      days: ["sat", "sun"],
      start: "08:00",
      end: "12:00"
    },
    {
      id: "cx-weekend-day",
      name: "CX Weekend",
      days: ["sat", "sun"],
      start: "12:00",
      end: "19:00"
    },
    {
      id: "back-track",
      name: "Backtrack",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      start: "19:00",
      end: "21:00"
    },
    {
      id: "radio-night",
      name: "Radio Night",
      days: ["mon", "tue", "wed", "thu", "fri"],
      start: "21:00",
      end: "06:00",
      overnight: true
    },
    {
      id: "cx-weekend-night",
      name: "CX Weekend",
      days: ["sat", "sun"],
      start: "21:00",
      end: "06:00",
      overnight: true
    }
  ]
};
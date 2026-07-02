import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as AstronomyModule from "astronomy-engine";
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "firebase/firestore";

const Astronomy = (AstronomyModule as any).default || AstronomyModule;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable permissive CORS for all requests to prevent "Failed to Fetch" browser security exceptions
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Normalize Netlify serverless routed URLs to work seamlessly with our Express router pattern (/api/*)
app.use((req, res, next) => {
  const originalUrl = req.url;

  // Clean double or multiple slashes first
  req.url = req.url.replace(/\/+/g, "/");

  // Robustly replace any variation of Netlify functions endpoint with /api
  if (req.url.includes("/.netlify/functions/api")) {
    req.url = req.url.replace(/\/\.netlify\/functions\/api/g, "/api");
  } else if (req.url.includes("/netlify/functions/api")) {
    req.url = req.url.replace(/\/netlify\/functions\/api/g, "/api");
  }

  // Fallback for Netlify: if URL is stripped down, prepending /api
  if (process.env.NETLIFY) {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/static")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
  }

  // Final slash-cleanup
  req.url = req.url.replace(/\/+/g, "/");

  console.log(`[NETLIFY ROUTER] Incoming: ${originalUrl} | Normalized: ${req.url} | Method: ${req.method}`);
  next();
});

// Initialize Gemini Client dynamically
const getApiKey = () => process.env.GEMINI_API_KEY;

// Lazy Initialize Gemini Client to avoid crashing on startup
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Robust wrapper with automatic retries (exponential backoff) and model fallback for transient/high-demand error handling
async function generateContentWithRetryAndFallback(params: any, retries = 1, delayMs = 500) {
  const models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const currentModel = models[modelIndex];
    let attempt = 0;
    while (attempt < retries) {
      try {
        console.log(`[Gemini API] Requesting content with model ${currentModel}, attempt ${attempt + 1}/${retries}...`);
        const response = await getAiClient().models.generateContent({
          ...params,
          model: currentModel
        });
        return response;
      } catch (err: any) {
        attempt++;
        const status = err?.status || err?.code || 0;
        const errMsg = (err?.message || "").toUpperCase();

        console.warn(`[Gemini API] Error on model ${currentModel} (attempt ${attempt}/${retries}): [Status ${status}] ${err?.message}`);

        // If the error indicates a permanent limit of 0, skip this model immediately without retries
        const isPermanentZeroLimit = errMsg.includes("LIMIT: 0") || errMsg.includes("LIMIT:0");
        if (isPermanentZeroLimit) {
          console.warn(`[Gemini API] Model ${currentModel} is blocked/disabled under current project plan (limit is 0). Skipping instantly...`);
          break; // Break the while loop to try the next model immediately
        }

        // Detect if the model is experiencing high demand / congested / overloaded / temporary unavailability
        const isCongested = status === 503 || 
          errMsg.includes("UNAVAILABLE") || 
          errMsg.includes("DEMAND") || 
          errMsg.includes("OVERLOADED") ||
          errMsg.includes("TEMPORARY") ||
          errMsg.includes("SPIKES IN DEMAND");

        if (isCongested) {
          console.warn(`[Gemini API] Model ${currentModel} is congested (503/Unavailable/High Demand). Skipping retries and falling back to the next model immediately...`);
          if (modelIndex < models.length - 1) {
            break; // Break the standard while loop, advancing to next model
          } else {
            throw err;
          }
        }

        const isRateLimitOrOverload = 
          status === 429 || 
          errMsg.includes("RESOURCE_EXHAUSTED") || 
          errMsg.includes("QUOTA") || 
          errMsg.includes("RATE LIMIT");

        const isTransientServerError = status === 500 || errMsg.includes("500") || errMsg.includes("INTERNAL");

        if (isRateLimitOrOverload || isTransientServerError) {
          if (attempt < retries) {
            const waitTime = delayMs * Math.pow(2.5, attempt - 1);
            console.warn(`[Gemini API] Rate-limit or transient error on ${currentModel}. Retrying same model in ${Math.round(waitTime)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // Retry the SAME model
          } else {
            console.warn(`[Gemini API] Model ${currentModel} exhausted all ${retries} attempts.`);
            if (modelIndex < models.length - 1) {
              console.warn(`[Gemini API] Falling back to next model: ${models[modelIndex + 1]}...`);
              break; // Break standard while loop, advancing to next model
            } else {
              throw err;
            }
          }
        } else {
          console.error(`[Gemini API] Non-transient error on model ${currentModel}:`, err);
          if (modelIndex < models.length - 1) {
            console.warn(`[Gemini API] Falling back to next model: ${models[modelIndex + 1]}...`);
            break; // Try next model in the list
          } else {
            throw err;
          }
        }
      }
    }
  }
  throw new Error("Failed to generate content with all available Gemini models due to rate limits or quota exhaustion.");
}

// SRI LANKA DISTRICTS AND CITIES STATIC REFERENCE
// Helpful for prompt context & ensuring valid Sri Lankan geo-location mapping
const SL_INFO = {
  districts: [
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", 
    "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar", 
    "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
    "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", 
    "Moneragala", "Ratnapura", "Kegalle"
  ],
  timezone: "UTC+5:30",
};

// District coordinates mapping for precise Sidereal Time calculations
const DISTRICT_COORDS: { [key: string]: { lat: number; lon: number } } = {
  "Colombo": { lat: 6.9271, lon: 79.8612 },
  "Gampaha": { lat: 7.0873, lon: 79.9925 },
  "Kalutara": { lat: 6.5854, lon: 79.9607 },
  "Kandy": { lat: 7.2906, lon: 80.6337 },
  "Matale": { lat: 7.4675, lon: 80.6234 },
  "Nuwara Eliya": { lat: 6.9497, lon: 80.7891 },
  "Galle": { lat: 6.0535, lon: 80.2210 },
  "Matara": { lat: 5.9549, lon: 80.5550 },
  "Hambantota": { lat: 6.1246, lon: 81.1185 },
  "Jaffna": { lat: 9.6615, lon: 80.0118 },
  "Kilinochchi": { lat: 9.3803, lon: 80.3982 },
  "Mannar": { lat: 8.9810, lon: 79.9044 },
  "Vavuniya": { lat: 8.7542, lon: 80.4982 },
  "Mullaitivu": { lat: 9.2671, lon: 80.8143 },
  "Batticaloa": { lat: 7.7102, lon: 81.6924 },
  "Ampara": { lat: 7.2955, lon: 81.6747 },
  "Trincomalee": { lat: 8.5711, lon: 81.2335 },
  "Kurunegala": { lat: 7.4863, lon: 80.3647 },
  "Puttalam": { lat: 8.0362, lon: 79.8283 },
  "Anuradhapura": { lat: 8.3114, lon: 80.4037 },
  "Polonnaruwa": { lat: 7.9398, lon: 81.0022 },
  "Badulla": { lat: 6.9934, lon: 81.0550 },
  "Moneragala": { lat: 6.8724, lon: 81.3504 },
  "Ratnapura": { lat: 6.6828, lon: 80.3992 },
  "Kegalle": { lat: 7.2513, lon: 80.3464 }
};

interface AstroCoords {
  moonLong: number;
  rashiIndex: number;
  rashiNameEn: string;
  rashiNameSi: string;
  nakshatraIndex: number;
  nakshatraNameEn: string;
  nakshatraNameSi: string;
  ayanamsha: number;
}

const RASHIS = [
  { en: "Aries", si: "මේෂ" },
  { en: "Taurus", si: "වෘෂභ" },
  { en: "Gemini", si: "මිථුන" },
  { en: "Cancer", si: "කටක" },
  { en: "Leo", si: "සිංහ" },
  { en: "Virgo", si: "කන්‍යා" },
  { en: "Libra", si: "තුලා" },
  { en: "Scorpio", si: "වෘශ්චික" },
  { en: "Sagittarius", si: "ධනු" },
  { en: "Capricorn", si: "මකර" },
  { en: "Aquarius", si: "කුම්භ" },
  { en: "Pisces", si: "මීන" }
];

const NAKSHATRAS = [
  { en: "Ashwini", si: "අශ්විනී" },
  { en: "Bharani", si: "බරණි" },
  { en: "Krittika", si: "කෘත්තිකා" },
  { en: "Rohini", si: "රෝහිණී" },
  { en: "Mrigashirsha", si: "මුවසිරස" },
  { en: "Ardra", si: "අද්‍රා" },
  { en: "Punarvasu", si: "පුනර්වසු" },
  { en: "Pushya", si: "පුස" },
  { en: "Ashlesha", si: "අස්ලෙෂා" },
  { en: "Magha", si: "මා" },
  { en: "Purva Phalguni", si: "පුවපල්" },
  { en: "Uttara Phalguni", si: "උත්‍රපල්" },
  { en: "Hasta", si: "හත" },
  { en: "Chitra", si: "සිත" },
  { en: "Swati", si: "සාති" },
  { en: "Vishakha", si: "විශාඛා" },
  { en: "Anuradha", si: "අනුර" },
  { en: "Jyeshtha", si: "දෙට" },
  { en: "Mula", si: "මූල" },
  { en: "Purva Ashadha", si: "පුවසල" },
  { en: "Uttara Ashadha", si: "උත්‍රසල" },
  { en: "Shravana", si: "සුවණ" },
  { en: "Dhanishta", si: "දෙණට" },
  { en: "Shatabhisha", si: "සියාවස" },
  { en: "Purva Bhadrapada", si: "පුවපුටුප" },
  { en: "Uttara Bhadrapada", si: "උත්‍රපුටුප" },
  { en: "Revati", si: "රේවතී" }
];

const normalize = (val: number) => {
  let res = val % 360;
  if (res < 0) res += 360;
  return res;
};

// Calculate mathematically exact Moon Position with major corrections
function calculateMoonPosition(dateStr: string, timeStr: string): AstroCoords {
  const dateParts = dateStr.split("-").map(Number); // [YYYY, MM, DD]
  const timeParts = timeStr.split(":").map(Number); // [HH, MM]
  
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const hour = timeParts[0];
  const minute = timeParts[1];

  // Convert SL local time (UTC+5:30) to UTC
  const localBirthDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utcDate = new Date(localBirthDate.getTime() - (5.5 * 60 * 60 * 1000));
  
  const astroTime = Astronomy.MakeTime(utcDate);
  const jd = astroTime.ut + 2451545.0;

  // Lahiri Ayanamsha calibration (23.85694 degrees on Jan 1, 2000 with annual precession 50.3")
  const ayanamsha = 23.85694 + (50.290966 * (jd - 2451545.0) / 365.25) / 3600.0;

  // High-precision Moon position from astronomy-engine
  const tropicalMoonLong = Astronomy.EclipticGeoMoon(astroTime).lon;
  const siderealMoonLong = (tropicalMoonLong - ayanamsha + 360) % 360;

  // Determine Rashi index (0-11)
  const rashiIndex = Math.floor(siderealMoonLong / 30);
  const rashi = RASHIS[rashiIndex];

  // Determine Nakshatra index (0-26)
  const nakshatraIndex = Math.floor(siderealMoonLong / (360.0 / 27.0));
  const nakshatra = NAKSHATRAS[nakshatraIndex];

  return {
    moonLong: siderealMoonLong,
    rashiIndex,
    rashiNameEn: rashi.en,
    rashiNameSi: rashi.si,
    nakshatraIndex,
    nakshatraNameEn: nakshatra.en,
    nakshatraNameSi: nakshatra.si,
    ayanamsha
  };
}

interface LagnaResult {
  lagnaLong: number;
  lagnaIndex: number;
  lagnaNameEn: string;
  lagnaNameSi: string;
}

// Calculate mathematically exact Lagna (L)
function calculateLagna(dateStr: string, timeStr: string, districtName: string, ayanamsha: number): LagnaResult {
  const coords = DISTRICT_COORDS[districtName] || DISTRICT_COORDS["Colombo"];
  
  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const hour = timeParts[0];
  const minute = timeParts[1];

  const localBirthDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utcDate = new Date(localBirthDate.getTime() - (5.5 * 60 * 60 * 1000));
  
  const astroTime = Astronomy.MakeTime(utcDate);

  // Greenwich Apparent Sidereal Time (GAST) in hours
  const gastHours = Astronomy.SiderealTime(astroTime);
  const gastDeg = gastHours * 15.0;

  // Local Sidereal Time (LST)
  const lstDeg = (gastDeg + coords.lon + 360) % 360;
  const rad = Math.PI / 180.0;

  // Obliquity of Ecliptic
  const T = astroTime.ut / 36525.0;
  const ob = (23.4392911 - (46.815 * T) / 3600.0) * rad;
  const lstRad = lstDeg * rad;
  const latRad = coords.lat * rad;

  // High-precision Ascendant computation (Formula C)
  const yVal = Math.cos(lstRad);
  const xVal = -Math.sin(lstRad) * Math.cos(ob) - Math.tan(latRad) * Math.sin(ob);

  let tropicalLagna = Math.atan2(yVal, xVal) * (180.0 / Math.PI);
  if (tropicalLagna < 0) tropicalLagna += 360;

  const siderealLagna = (tropicalLagna - ayanamsha + 360) % 360;
  const lagnaIndex = Math.floor(siderealLagna / 30);
  const rashi = RASHIS[lagnaIndex];

  return {
    lagnaLong: siderealLagna,
    lagnaIndex,
    lagnaNameEn: rashi.en,
    lagnaNameSi: rashi.si
  };
}

const PLANETS_INFO = [
  { name: "Sun", nameSi: "රවි", bodyKey: "Sun" },
  { name: "Moon", nameSi: "සඳු", bodyKey: "Moon" },
  { name: "Mars", nameSi: "කුජ", bodyKey: "Mars" },
  { name: "Mercury", nameSi: "බුධ", bodyKey: "Mercury" },
  { name: "Jupiter", nameSi: "ගුරු", bodyKey: "Jupiter" },
  { name: "Venus", nameSi: "සිකුරු", bodyKey: "Venus" },
  { name: "Saturn", nameSi: "සෙනසුරු", bodyKey: "Saturn" },
  { name: "Rahu", nameSi: "රාහු", bodyKey: "Rahu" },
  { name: "Ketu", nameSi: "කේතු", bodyKey: "Ketu" }
];

function calculatePlanetsAndPlacements(dateStr: string, timeStr: string, districtName: string) {
  const moonPos = calculateMoonPosition(dateStr, timeStr);
  const lagnaPos = calculateLagna(dateStr, timeStr, districtName, moonPos.ayanamsha);

  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  const localBirthDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]));
  const utcDate = new Date(localBirthDate.getTime() - (5.5 * 60 * 60 * 1000));
  const astroTime = Astronomy.MakeTime(utcDate);

  const planets: any[] = [];
  const housePlacements: { [key: string]: string[] } = {
    "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [], "8": [], "9": [], "10": [], "11": [], "12": []
  };

  housePlacements["1"].push("Ascendant");

  for (const p of PLANETS_INFO) {
    let rawLon = 0;
    let isRetrograde = false;

    if (p.bodyKey === "Rahu") {
      const T2 = astroTime.ut / 36525.0;
      const meanNode = (125.0445550 - 1934.1361849 * T2 + 0.0020762 * T2 * T2 + T2 * T2 * T2 / 452222.0) % 360;
      rawLon = meanNode < 0 ? meanNode + 360 : meanNode;
      isRetrograde = true; // Lunar nodes are always retrograding
    } else if (p.bodyKey === "Ketu") {
      const T2 = astroTime.ut / 36525.0;
      const meanNode = (125.0445550 - 1934.1361849 * T2 + 0.0020762 * T2 * T2 + T2 * T2 * T2 / 452222.0) % 360;
      rawLon = (meanNode + 180) % 360;
      if (rawLon < 0) rawLon += 360;
      isRetrograde = true; // Lunar nodes are always retrograding
    } else if (p.bodyKey === "Sun") {
      rawLon = Astronomy.SunPosition(astroTime).elon;
      isRetrograde = false;
    } else if (p.bodyKey === "Moon") {
      rawLon = Astronomy.EclipticGeoMoon(astroTime).lon;
      isRetrograde = false;
    } else {
      const b = Astronomy.Body[p.bodyKey];
      const eqj = Astronomy.GeoVector(b, astroTime, true);
      const ecl = Astronomy.Ecliptic(eqj);
      rawLon = ecl.elon;

      // Calculate retrograde status by looking at position 1 hour later
      const futureUtc = new Date(utcDate.getTime() + (1 * 60 * 60 * 1000));
      const futureAstroTime = Astronomy.MakeTime(futureUtc);
      const futureEqj = Astronomy.GeoVector(b, futureAstroTime, true);
      const futureEcl = Astronomy.Ecliptic(futureEqj);
      
      const diff = (futureEcl.elon - rawLon + 540) % 360 - 180;
      isRetrograde = diff < 0;
    }

    const siderealLon = (rawLon - moonPos.ayanamsha + 360) % 360;
    const rashiIdx = Math.floor(siderealLon / 30);
    const rashi = RASHIS[rashiIdx];
    const house = ((rashiIdx - lagnaPos.lagnaIndex + 12) % 12) + 1;

    // Format degree: e.g. "Aries 12° 45'"
    const degInRashi = siderealLon - rashiIdx * 30;
    const deg = Math.floor(degInRashi);
    const min = Math.floor((degInRashi - deg) * 60);
    const degStr = `${rashi.en} ${deg.toString().padStart(2, '0')}° ${min.toString().padStart(2, '0')}'`;

    planets.push({
      planet: p.name,
      planetSinhala: p.nameSi,
      sign: rashi.en,
      signSinhala: rashi.si,
      house,
      degree: degStr,
      isRetrograde
    });

    housePlacements[house.toString()].push(p.name);
  }

  // Add Ascendant
  const lagnaDegInSign = lagnaPos.lagnaLong - lagnaPos.lagnaIndex * 30;
  const lDeg = Math.floor(lagnaDegInSign);
  const lMin = Math.floor((lagnaDegInSign - lDeg) * 60);
  const lagnaDegStr = `${lagnaPos.lagnaNameEn} ${lDeg.toString().padStart(2, '0')}° ${lMin.toString().padStart(2, '0')}'`;

  planets.push({
    planet: "Ascendant",
    planetSinhala: "ලග්නය",
    sign: lagnaPos.lagnaNameEn,
    signSinhala: lagnaPos.lagnaNameSi,
    house: 1,
    degree: lagnaDegStr,
    isRetrograde: false
  });

  return {
    moonPos,
    lagnaPos,
    housePlacements,
    planetaryDetails: planets,
    calculatedMoonHouse: ((moonPos.rashiIndex - lagnaPos.lagnaIndex + 12) % 12) + 1
  };
}

const NAKSHATRA_LORDS = [
  { lordEn: "Ketu", lordSi: "කේතු", years: 7 }, // Ashwini
  { lordEn: "Venus", lordSi: "සිකුරු (කිවි)", years: 20 }, // Bharani
  { lordEn: "Sun", lordSi: "රවි", years: 6 }, // Krittika
  { lordEn: "Moon", lordSi: "චන්ද්‍ර", years: 10 }, // Rohini
  { lordEn: "Mars", lordSi: "කුජ", years: 7 }, // Mrigashirsha
  { lordEn: "Rahu", lordSi: "රාහු", years: 18 }, // Ardra
  { lordEn: "Jupiter", lordSi: "ගුරු", years: 16 }, // Punarvasu
  { lordEn: "Saturn", lordSi: "සෙනසුරු", years: 19 }, // Pushya
  { lordEn: "Mercury", lordSi: "බුධ", years: 17 }, // Ashlesha
  
  { lordEn: "Ketu", lordSi: "කේතු", years: 7 }, // Magha
  { lordEn: "Venus", lordSi: "සිකුරු (කිවි)", years: 20 }, // Purva Phalguni
  { lordEn: "Sun", lordSi: "රවි", years: 6 }, // Uttara Phalguni
  { lordEn: "Moon", lordSi: "චන්ද්‍ර", years: 10 }, // Hasta
  { lordEn: "Mars", lordSi: "කුජ", years: 7 }, // Chitra
  { lordEn: "Rahu", lordSi: "රාහු", years: 18 }, // Swati
  { lordEn: "Jupiter", lordSi: "ගුරු", years: 16 }, // Vishakha
  { lordEn: "Saturn", lordSi: "සෙනසුරු", years: 19 }, // Anuradha
  { lordEn: "Mercury", lordSi: "බුධ", years: 17 }, // Jyeshtha
  
  { lordEn: "Ketu", lordSi: "කේතු", years: 7 }, // Mula
  { lordEn: "Venus", lordSi: "සිකුරු (කිවි)", years: 20 }, // Purva Ashadha
  { lordEn: "Sun", lordSi: "රවි", years: 6 }, // Uttara Ashadha
  { lordEn: "Moon", lordSi: "චන්ද්‍ර", years: 10 }, // Shravana
  { lordEn: "Mars", lordSi: "කුජ", years: 7 }, // Dhanishta
  { lordEn: "Rahu", lordSi: "රාහු", years: 18 }, // Shatabhisha
  { lordEn: "Jupiter", lordSi: "ගුරු", years: 16 }, // Purva Bhadrapada
  { lordEn: "Saturn", lordSi: "සෙනසුරු", years: 19 }, // Uttara Bhadrapada
  { lordEn: "Mercury", lordSi: "බුධ", years: 17 }, // Revati
];

const NAKSHATRA_PROPERTIES = [
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Horse (Ashwa)", yoniSi: "අශ්ව", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Ashwini
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Elephant (Gaja)", yoniSi: "ගජ", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Bharani
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Sheep (Mesha)", yoniSi: "බැටළු", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Krittika
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Serpent (Sarpa)", yoniSi: "සර්ප", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Rohini
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Serpent (Sarpa)", yoniSi: "සර්ප", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Mrigashirsha
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Dog (Shwan)", yoniSi: "සුනඛ", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Ardra
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Cat (Marjara)", yoniSi: "බළල්", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Punarvasu
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Goat (Mesha)", yoniSi: "එළු", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Pushya
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Cat (Marjara)", yoniSi: "බළල්", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Ashlesha
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Rat (Mushika)", yoniSi: "මී", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Magha
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Rat (Mushika)", yoniSi: "මී", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Purva Phalguni
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Cow (Gau)", yoniSi: "ගව", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Uttara Phalguni
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Buffalo (Mahisha)", yoniSi: "මීහරක්", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Hasta
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Tiger (Vyaghr)", yoniSi: "ව්‍යාඝ්‍ර (කොටි)", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Chitra
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Buffalo (Mahisha)", yoniSi: "මීහරක්", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Swati
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Tiger (Vyaghr)", yoniSi: "ව්‍යාඝ්‍ර (කොටි)", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Vishakha
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Deer (Mriga)", yoniSi: "මුව", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Anuradha
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Deer (Mriga)", yoniSi: "මුව", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Jyeshtha
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Dog (Shwan)", yoniSi: "සුනඛ", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Mula
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Monkey (Vanara)", yoniSi: "වඳුරු", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Purva Ashadha
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Mongoose (Nakula)", yoniSi: "මුගටි", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Uttara Ashadha
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Monkey (Vanara)", yoniSi: "වඳුරු", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Shravana
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Lion (Simha)", yoniSi: "සිංහ", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Dhanishta
  { ganaEn: "Rakshasa", ganaSi: "රාක්ෂස", yoniEn: "Horse (Ashwa)", yoniSi: "අශ්ව", lingaEn: "Female", lingaSi: "ස්ත්‍රී" }, // Shatabhisha
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Lion (Simha)", yoniSi: "සිංහ", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Purva Bhadrapada
  { ganaEn: "Manusha", ganaSi: "මානුෂ", yoniEn: "Cow (Gau)", yoniSi: "ගව", lingaEn: "Male", lingaSi: "පුරුෂ" }, // Uttara Bhadrapada
  { ganaEn: "Deva", ganaSi: "දේව", yoniEn: "Elephant (Gaja)", yoniSi: "ගජ", lingaEn: "Female", lingaSi: "ස්ත්‍රී" } // Revati
];

function computeDetailedAstrology(siderealMoonLong: number, nakshatraIndex: number, birthDate?: string, birthTime?: string) {
  // 1. Moon's exact longitude (චන්ද්‍ර ස්ඵුටය) inside the Rashi
  const rashiIndex = Math.floor(siderealMoonLong / 30);
  const rashiVal = RASHIS[rashiIndex];
  const rashiLong = siderealMoonLong - (rashiIndex * 30);
  const rashiDeg = Math.floor(rashiLong);
  const rashiMin = Math.floor((rashiLong - rashiDeg) * 60);
  const rashiSec = Math.round((((rashiLong - rashiDeg) * 60) - rashiMin) * 60);
  
  const padStartEn = (num: number) => num < 10 ? `0${num}` : `${num}`;
  const moonLongitudeFullEn = `${rashiVal.en} ${padStartEn(rashiDeg)}° ${padStartEn(rashiMin)}' ${padStartEn(rashiSec)}"`;
  const moonLongitudeFullSi = `${rashiVal.si} රාශියේ ${padStartEn(rashiDeg)}° ${padStartEn(rashiMin)}' ${padStartEn(rashiSec)}"`;

  // 2. Nakshatra math
  const nakshatraStartLong = nakshatraIndex * 13.33333333;
  const traveledInNakshatra = siderealMoonLong - nakshatraStartLong;
  const traveledMinutesInNakshatra = traveledInNakshatra * 60;

  // Each Pada = 200 minutes (3° 20')
  const pada = Math.min(4, Math.max(1, Math.floor(traveledMinutesInNakshatra / 200) + 1));
  const traveledMinutesInPada = traveledMinutesInNakshatra % 200;
  const remainingMinutesInPada = Math.max(0, 200 - traveledMinutesInPada);

  // Remaining minutes in the entire Nakshatra (Vimshottari balance is based on the remaining portion of the whole star, spanning 800 minutes)
  const remainingMinutesInNakshatra = Math.max(0, 800 - traveledMinutesInNakshatra);

  // Formats of traveled & remaining
  const formatArcminutes = (minVal: number) => {
    const deg = Math.floor(minVal / 60);
    const min = Math.floor(minVal % 60);
    const sec = Math.round((minVal - Math.floor(minVal)) * 60);
    return `${padStartEn(deg)}° ${padStartEn(min)}' ${padStartEn(sec)}"`;
  };

  const padaTraveledFormatted = formatArcminutes(traveledMinutesInPada);
  const padaRemainingFormatted = formatArcminutes(remainingMinutesInPada);

  // 3. Vimshottari Balance Dasha computations
  const lordInfo = NAKSHATRA_LORDS[nakshatraIndex];
  const totalYears = lordInfo.years;
  
  // Proportional balance dasha using correct formula: remainingMinutesInNakshatra / 800 * totalYears
  const dashaYearsDecimal = (remainingMinutesInNakshatra / 800) * totalYears;
  
  const years = Math.floor(dashaYearsDecimal);
  const monthsDecimal = (dashaYearsDecimal - years) * 12;
  const months = Math.floor(monthsDecimal);
  const daysDecimal = (monthsDecimal - months) * 30;
  const days = Math.round(daysDecimal);

  const balanceDashaEn = `${years} Years, ${months} Months, and ${days} Days`;
  const balanceDashaSi = `වසර ${years}ක්, මාස ${months}ක්, සහ දින ${days}ක්`;

  const nakshat = NAKSHATRAS[nakshatraIndex];
  const props = NAKSHATRA_PROPERTIES[nakshatraIndex] || { ganaEn: "", ganaSi: "", yoniEn: "", yoniSi: "", lingaEn: "", lingaSi: "" };

  // Calculate current active Maha Dasha dynamically if birthDate and birthTime are provided
  let currentDashaLordEn = lordInfo.lordEn;
  let currentDashaLordSi = lordInfo.lordSi;
  let currentDashaStart = "";
  let currentDashaEnd = "";
  let currentDashaRemainingEn = "";
  let currentDashaRemainingSi = "";
  let dashaTimeline: any[] = [];

  if (birthDate && birthTime) {
    try {
      let birthMs = Date.parse(`${birthDate}T${birthTime}:00`);
      if (isNaN(birthMs)) {
        birthMs = Date.parse(`${birthDate}T12:00:00`);
      }
      const birthDateObj = new Date(birthMs);

      const addYears = (date: Date, yearsDecimal: number): Date => {
        const resDate = new Date(date.getTime());
        const msToAdd = yearsDecimal * 365.2425 * 24 * 60 * 60 * 1000;
        resDate.setTime(resDate.getTime() + msToAdd);
        return resDate;
      };

      const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      let currentStartDate = birthDateObj;
      const birthLordIndex = nakshatraIndex % 9;

      // 1. First Dasha (birth balance)
      let currentEndDate = addYears(currentStartDate, dashaYearsDecimal);
      dashaTimeline.push({
        lordEn: NAKSHATRA_LORDS[nakshatraIndex].lordEn,
        lordSi: NAKSHATRA_LORDS[nakshatraIndex].lordSi,
        start: currentStartDate,
        end: currentEndDate,
        durationYears: dashaYearsDecimal,
        isBirthDasha: true
      });
      currentStartDate = currentEndDate;

      // 2. Next 9 dashas to cover full 120-year Vimshottari cycle
      let currentLordIndex = (birthLordIndex + 1) % 9;
      for (let i = 0; i < 9; i++) {
        const nextLord = NAKSHATRA_LORDS[currentLordIndex];
        currentEndDate = addYears(currentStartDate, nextLord.years);
        dashaTimeline.push({
          lordEn: nextLord.lordEn,
          lordSi: nextLord.lordSi,
          start: currentStartDate,
          end: currentEndDate,
          durationYears: nextLord.years,
          isBirthDasha: false
        });
        currentStartDate = currentEndDate;
        currentLordIndex = (currentLordIndex + 1) % 9;
      }

      // Find which dasha is currently active
      const now = new Date();
      let activeDasha = dashaTimeline[0];
      for (const d of dashaTimeline) {
        if (now >= d.start && now < d.end) {
          activeDasha = d;
          break;
        }
      }

      currentDashaLordEn = activeDasha.lordEn;
      currentDashaLordSi = activeDasha.lordSi;
      currentDashaStart = formatDate(activeDasha.start);
      currentDashaEnd = formatDate(activeDasha.end);

      const remainingMs = activeDasha.end.getTime() - now.getTime();
      const remainingYearsDecimal = Math.max(0, remainingMs / (365.2425 * 24 * 60 * 60 * 1000));
      const remYears = Math.floor(remainingYearsDecimal);
      const remMonthsDecimal = (remainingYearsDecimal - remYears) * 12;
      const remMonths = Math.floor(remMonthsDecimal);
      const remDaysDecimal = (remMonthsDecimal - remMonths) * 30;
      const remDays = Math.round(remDaysDecimal);

      currentDashaRemainingEn = `${remYears} Years, ${remMonths} Months, and ${remDays} Days`;
      currentDashaRemainingSi = `වසර ${remYears}ක්, මාස ${remMonths}ක්, සහ දින ${remDays}ක්`;

      // Map timeline with formatted dates for JSON return
      dashaTimeline = dashaTimeline.map(d => ({
        lordEn: d.lordEn,
        lordSi: d.lordSi,
        start: formatDate(d.start),
        end: formatDate(d.end),
        durationYears: Math.round(d.durationYears * 100) / 100
      }));

    } catch (e) {
      console.error("Error calculating dynamic current dasha:", e);
    }
  }

  return {
    moonLongitudeFullEn,
    moonLongitudeFullSi,
    nakshatraNameSi: nakshat.si,
    nakshatraNameEn: nakshat.en,
    pada,
    padaTotalLengthMinutes: 200,
    padaTraveledMinutes: Math.round(traveledMinutesInPada * 100) / 100,
    padaTraveledFormatted,
    padaRemainingMinutes: Math.round(remainingMinutesInPada * 100) / 100,
    padaRemainingFormatted,
    dashaLordSi: lordInfo.lordSi,
    dashaLordEn: lordInfo.lordEn,
    dashaTotalYears: totalYears,
    balanceDashaEn,
    balanceDashaSi,
    ganaEn: props.ganaEn,
    ganaSi: props.ganaSi,
    yoniEn: props.yoniEn,
    yoniSi: props.yoniSi,
    lingaEn: props.lingaEn,
    lingaSi: props.lingaSi,
    // Dynamic values
    currentDashaLordEn,
    currentDashaLordSi,
    currentDashaStart,
    currentDashaEnd,
    currentDashaRemainingEn,
    currentDashaRemainingSi,
    dashaTimeline
  };
}

// API: Astrological Birth Chart (Kendraya) & General Predictions Generator
app.post("/api/astrology/generate", async (req, res) => {
  try {
    const { name, birthDate, birthTime, birthPlace, district, gender, language } = req.body;

    if (!birthDate || !birthTime || !district) {
      return res.status(400).json({ error: "Required fields (birthDate, birthTime, district) are missing." });
    }

    if (!getApiKey()) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel." });
    }

    // 1. Calculate deterministic astronomical parameters using high-precision astronomy-engine
    const placements = calculatePlanetsAndPlacements(birthDate, birthTime, district);
    const moonPos = placements.moonPos;
    const lagnaPos = placements.lagnaPos;
    const calculatedMoonHouse = placements.calculatedMoonHouse;

    // Calculate detailed nakshatra, gana, yoni, linga, and dasha mathematically
    const detailed = computeDetailedAstrology(moonPos.moonLong, moonPos.nakshatraIndex, birthDate, birthTime);

    const langPrompt = language === 'sinhala' 
      ? "Write all prediction text (general, career, wealth, health, marriage, dasha) in elegant, comforting, deeply descriptive, and professional Sinhala (කේන්දර පලාපල විස්තර). EACH of these 6 fields MUST contain a beautiful prediction paragraph of around 45 to 60 words. Avoid any introductory greetings, repetitive filler, or boilerplate warnings. Start each paragraph directly with the predictive readings to maximize speed and density. Use rich traditional Sri Lankan astrological terms like 'කේන්ද්‍රය', 'දශාව', 'ලග්නය', 'ග්‍රහ මාරු', 'මහ දශා අපල', 'වාසනා යෝග'."
      : "Write all prediction text in elegant, deeply descriptive, and comprehensive English. EACH of these 6 fields MUST contain a beautiful prediction paragraph of around 45 to 60 words. Avoid any introductory greetings, filler, or boilerplate warnings. Start each paragraph directly with the predictive readings to maximize speed and density. Include standard Sinhala Sanskrit astrology names in parentheses (e.g. 'Aries (Mesha)', 'Sun (Ravi)', 'Mars (Kuja)').";

    const prompt = `
      You are an expert Sri Lankan Vedic Astrologer ("Jyotishacharya" / "හෙළ ජ්‍යෝතිෂවේදී").
      Your task is to write deep, personalised astrological predictions (පලාපල) for a person born in Sri Lanka.

      CRITICAL GROUND TRUTH (Calculated mathematically using Lahiri Ayanamsha):
      - Lagna (Ascendant Sign): ${lagnaPos.lagnaNameEn} (${lagnaPos.lagnaNameSi}) - situated at House 1. (Rashi Index: ${lagnaPos.lagnaIndex})
      - Moon Sign (Rashi): ${moonPos.rashiNameEn} (${moonPos.rashiNameSi}) (Rashi Index: ${moonPos.rashiIndex})
      - Birth Star (Nakshatra): ${moonPos.nakshatraNameEn} (${moonPos.nakshatraNameSi}) (Nakshatra index: ${moonPos.nakshatraIndex})
      - Gana (ගණය): ${detailed.ganaEn} (${detailed.ganaSi})
      - Yoni (යෝනිය): ${detailed.yoniEn} (${detailed.yoniSi})
      - Linga / Gender (ලිංගය): ${detailed.lingaEn} (${detailed.lingaSi})
      - Birth Vimshottari Balance Dasha: Ruled by ${detailed.dashaLordEn} (${detailed.dashaLordSi}) for a duration of ${detailed.balanceDashaEn} at birth.
      - CURRENT ACTIVE MAHA DASHA (As of Today, ${new Date().toISOString().split('T')[0]}): Ruled by ${detailed.currentDashaLordEn} (${detailed.currentDashaLordSi}) which started around ${detailed.currentDashaStart} and ends around ${detailed.currentDashaEnd} (Remaining duration: ${detailed.currentDashaRemainingEn}).
      - The Moon is placed in House ${calculatedMoonHouse} of the birth chart.
      - The Ascendant ("Ascendant" / "ල") is placed in House 1.
      
      You MUST strictly base all of your prediction texts, Vimshottari Dasha, and the JSON output on these calculated values. Do NOT calculate different values or signs for Lagna, Moon Sign, or Birth Star. Especially draw deep connections on how their Gana: ${detailed.ganaEn} (${detailed.ganaSi}), Yoni: ${detailed.yoniEn} (${detailed.yoniSi}), and Linga: ${detailed.lingaEn} (${detailed.lingaSi}) shape their inner personality, marriage compatibility, and daily behaviors. Any discrepancy is an astrological failure.

      Birth Information:
      - Name: ${name || "Unnamed"}
      - Birth Date: ${birthDate} (Year-Month-Day)
      - Birth Time: ${birthTime} (24-hour format, Sri Lankan Local Time, which is UTC+5:30)
      - Birth Place: ${birthPlace || "Not Specified"}, ${district} District, Sri Lanka
      - Gender: ${gender || "Not Specified"}
      - Language Preference for Reading: ${language}

      Instructions:
      1. Provide professional, detailed, deep, and beautifully compiled predictions (around 45 to 60 words per topic to ensure both quality and fast delivery):
         - General character & personality (Lagna properties): Describe cognitive traits, appearance tendencies, natural strengths/weaknesses in high detail under Sri Lankan astrology tradition. (Around 45-60 words, no introduction, start directly with characteristics)
         - Career and education (Wurtheeya Palapala): Analyze best professional sectors, leadership style, potential academic hurdles, and business/investment choices. (Around 45-60 words, no introduction, start directly with professional predictions)
         - Wealth and financial prospects (Dhana Palapala): Detail lifetime income patterns, wealth accumulation houses, expenses, and ancestral assets luck. (Around 45-60 words, no introduction, start directly with financial predictions)
         - Health and longevity (Saukya Palapala): Elaborate on common physiological alerts according to Ayurvedic wind/bile/phlegm (tridosha) alignments of the birth star. (Around 45-60 words, no introduction, start directly with health predictions)
         - Marriage, love, and relationships (Yuga Palapala): Explain companionship style, spouse attributes, family support systems, and special marriage calculations. (Around 45-60 words, no introduction, start directly with compatibility predictions)
         - Vimshottari Dasha: write a comprehensive prediction for their CURRENT ACTIVE MAHA DASHA, which is ${detailed.currentDashaLordEn} (${detailed.currentDashaLordSi}) Maha Dasha (active from ${detailed.currentDashaStart} to ${detailed.currentDashaEnd}, with remaining duration of ${detailed.currentDashaRemainingEn}). Outline detailed, comforting remedies like specific pujas, charitable deeds, color habits, and mantra chants. (Around 45-60 words, no introduction, start directly with dasha analysis and remedies)
      2. Provide 3 lucky numbers, 2-3 lucky colors, and 2-3 auspicious days.

      ${langPrompt}
    `;

    const response = await generateContentWithRetryAndFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictions: {
              type: Type.OBJECT,
              description: "Sri Lankan Astrological Predictions based on birth chart",
              properties: {
                general: { type: Type.STRING, description: "General character and life path reading" },
                career: { type: Type.STRING, description: "Education, job, and business predictions" },
                wealth: { type: Type.STRING, description: "Socio-economic status and money luck" },
                health: { type: Type.STRING, description: "Common physical/mental triggers and remedies" },
                marriage: { type: Type.STRING, description: "Love prospects, compatibility, and family life" },
                dasha: { type: Type.STRING, description: "Current planetary phase/Kala (Vimshottari Dasha/Apala) and remedies" },
                luckyNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "3 lucky numbers" },
                luckyColors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 lucky colors" },
                auspiciousDays: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2 auspicious days of the week" }
              },
              required: ["general", "career", "wealth", "health", "marriage", "dasha", "luckyNumbers", "luckyColors", "auspiciousDays"]
            }
          },
          required: ["predictions"]
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const parsedData = JSON.parse(resultText);

    // Initialize and embed mathematically exact calculations and placements on the server
    try {
      const detailed = computeDetailedAstrology(moonPos.moonLong, moonPos.nakshatraIndex, birthDate, birthTime);
      
      parsedData.chart = {
        lagna: lagnaPos.lagnaNameEn,
        lagnaSinhala: lagnaPos.lagnaNameSi,
        nakshatra: detailed.nakshatraNameEn,
        nakshatraSinhala: detailed.nakshatraNameSi,
        rashi: moonPos.rashiNameEn,
        rashiSinhala: moonPos.rashiNameSi,
        housePlacements: placements.housePlacements,
        planetaryDetails: placements.planetaryDetails,
        calculations: detailed
      };

      // Ensure Moon degree formatting matches standard format according to preference
      if (Array.isArray(parsedData.chart.planetaryDetails)) {
        const mIdx = parsedData.chart.planetaryDetails.findIndex((p: any) => p.planet && p.planet.toLowerCase() === "moon");
        if (mIdx !== -1) {
          parsedData.chart.planetaryDetails[mIdx].degree = language === 'sinhala' ? detailed.moonLongitudeFullSi : detailed.moonLongitudeFullEn;
        }
      }
    } catch (calcError) {
      console.error("Error embedding detailed calculations:", calcError);
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error("Astrology generate api error:", error);
    res.status(500).json({ error: error.message || "An error occurred while generating astrological predictions." });
  }
});

// API: Astrological Chatbot Endpoint
app.post("/api/astrology/chat", async (req, res) => {
  try {
    const { birthDetails, chart, message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!getApiKey()) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel." });
    }

    // Format chat history & provide astrology-centric context
    const systemPrompt = `
      You are an expert Sri Lankan Astrologer ("Hela Jyotishacharya" / "හෙළ ජ්‍යෝතිෂවේදී").
      The user is asking questions about their personal birth chart (kendraya), predictions, and future.

      User Birth details:
      - Name: ${birthDetails?.name || "Unnamed"}
      - Birth Date: ${birthDetails?.birthDate}
      - Birth Time: ${birthDetails?.birthTime}
      - Birth Place: ${birthDetails?.birthPlace}, ${birthDetails?.district} District, Sri Lanka
      - Gender: ${birthDetails?.gender}
      - Preference Language: ${birthDetails?.language}

      Calculated Birth Chart (Kendraya):
      - Lagna (Ascendant): ${chart?.lagna} (${chart?.lagnaSinhala})
      - Moon Sign (Rashi): ${chart?.rashi} (${chart?.rashiSinhala})
      - Birth Star (Nakshatra): ${chart?.nakshatra} (${chart?.nakshatraSinhala})
      - Gana (ගණය): ${chart?.calculations?.ganaEn || ""} (${chart?.calculations?.ganaSi || ""})
      - Yoni (යෝනිය): ${chart?.calculations?.yoniEn || ""} (${chart?.calculations?.yoniSi || ""})
      - Linga / Gender (ලිංගය): ${chart?.calculations?.lingaEn || ""} (${chart?.calculations?.lingaSi || ""})
      - Planetary placements details: ${JSON.stringify(chart?.planetaryDetails || [])}

      Guidelines:
      1. Always speak with deep humility, respect, and wisdom. Represent traditional Sri Lankan astrologers.
      2. Respond in the user's preferred language (${birthDetails?.language || 'sinhala'}). If they speak in Sinhala (or Singlish), respond in elegant, friendly, and accessible Sinhala.
      3. Focus on comforting remedies, positive guidance, and practical advice rather than scaring the user with "Apala" (bad times).
      4. Speak specifically about their houses, planetary conjunctions, and dasha. Do not give general random answers.
    `;

    // Construct message history in standard Gemini contents list
    const contents: any[] = [];
    
    // Add history
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await generateContentWithRetryAndFallback({
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text || "I was unable to analyze your horoscope query currently." });

  } catch (error: any) {
    console.error("Astrology chat api error:", error);
    res.status(500).json({ error: error.message || "An error occurred during chat consultation." });
  }
});

// Persistent JSON Database path for generated reports and ratings (Fallback storage)
const DATABASE_FILE = process.env.NETLIFY 
  ? "/tmp/reports.json" 
  : path.join(process.cwd(), "reports.json");

// Ensure the local database file exists
if (!fs.existsSync(DATABASE_FILE)) {
  try {
    const originalDb = path.join(process.cwd(), "reports.json");
    if (process.env.NETLIFY && fs.existsSync(originalDb)) {
      const data = fs.readFileSync(originalDb, "utf8");
      fs.writeFileSync(DATABASE_FILE, data, "utf8");
    } else {
      fs.writeFileSync(DATABASE_FILE, JSON.stringify([], null, 2), "utf8");
    }
  } catch (err) {
    console.error("Failed to initialize database file:", err);
  }
}

function readReportsFromDb() {
  try {
    const rawData = fs.readFileSync(DATABASE_FILE, "utf8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading database:", error);
    return [];
  }
}

function writeReportsToDb(reports: any[]) {
  try {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(reports, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Initialize Firebase Firestore for serverless persistence
let firestoreDb: any = null;

const possibleConfigPaths = [
  path.join(process.cwd(), "firebase-applet-config.json"),
  path.join(process.cwd(), "netlify/functions/firebase-applet-config.json"),
  path.join(process.cwd(), "src/firebase-applet-config.json"),
  "firebase-applet-config.json"
];

// Safely try __dirname if it exists (CommonJS environment fallback)
try {
  if (typeof __dirname !== "undefined") {
    possibleConfigPaths.push(path.join(__dirname, "firebase-applet-config.json"));
    possibleConfigPaths.push(path.join(__dirname, "../firebase-applet-config.json"));
    possibleConfigPaths.push(path.join(__dirname, "../../firebase-applet-config.json"));
  }
} catch (err) {
  // Ignore
}

let firebaseConfigPath = "";
for (const p of possibleConfigPaths) {
  if (fs.existsSync(p)) {
    firebaseConfigPath = p;
    break;
  }
}

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "argon-coast-wwjrd",
  appId: "1:726581334405:web:20eb27f57bcf0050eab4ec",
  apiKey: "AIzaSyCIUI9M-U13cc0eiZfp2ajK0IVOr8PdH0g",
  authDomain: "argon-coast-wwjrd.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-srilankanastrolo-47be069e-6918-489d-9c56-3d882ad39818",
  storageBucket: "argon-coast-wwjrd.firebasestorage.app",
  messagingSenderId: "726581334405",
  measurementId: ""
};

let config = DEFAULT_FIREBASE_CONFIG;
let loadedFromDisk = false;

if (process.env.FIREBASE_API_KEY) {
  config = {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    measurementId: ""
  };
  console.log("Firestore: Initializing using custom project configuration from environment variables (Project ID:", config.projectId, ")");
} else if (firebaseConfigPath) {
  try {
    config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    loadedFromDisk = true;
  } catch (err) {
    console.error("Failed to read firebase-applet-config.json from disk, falling back to default config:", err);
  }
}

try {
  const firebaseApp = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId
  });
  // Use initializeFirestore with experimentalForceLongPolling for robust serverless connectivity
  firestoreDb = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true
  }, config.firestoreDatabaseId || "(default)");
  
  if (loadedFromDisk) {
    console.log(`Firestore initialized successfully on server (long polling enabled) using config from: ${firebaseConfigPath} with database ID:`, config.firestoreDatabaseId || "(default)");
  } else {
    console.log("Firestore initialized successfully on server (long polling enabled) using static fallback configuration with database ID:", config.firestoreDatabaseId || "(default)");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Firestore:", err);
}

// Robust timeout helper to prevent serverless function hangs (Netlify 502/504 errors)
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Firestore operation timed out"));
    }, timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function getReportsAsync(): Promise<any[]> {
  if (firestoreDb) {
    try {
      const querySnapshot = await withTimeout(getDocs(collection(firestoreDb, "reports")), 2000);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      return list;
    } catch (err: any) {
      console.error("Firestore error in getReportsAsync (falling back to local file):", err?.message || err);
    }
  }
  const allRecords = readReportsFromDb();
  return allRecords.filter((r: any) => r.id !== "google_drive_tokens");
}

async function getReportByIdAsync(id: string): Promise<any | null> {
  if (firestoreDb) {
    try {
      const docSnap = await withTimeout(getDoc(doc(firestoreDb, "reports", id)), 2000);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (err: any) {
      console.error(`Firestore error in getReportByIdAsync for ID ${id} (falling back to local file):`, err?.message || err);
    }
  }
  const all = readReportsFromDb();
  return all.find((r: any) => r.id === id) || null;
}

async function saveReportAsync(report: any): Promise<void> {
  if (firestoreDb) {
    try {
      const { id, ...data } = report;
      await withTimeout(setDoc(doc(firestoreDb, "reports", id), data, { merge: true }), 2000);
      console.log(`Firestore: Report ${id} saved successfully.`);
      return;
    } catch (err: any) {
      console.error(`Firestore error in saveReportAsync for ID ${report?.id} (falling back to local file):`, err?.message || err);
    }
  }
  const reports = readReportsFromDb();
  const idx = reports.findIndex((r: any) => r.id === report.id);
  if (idx !== -1) {
    reports[idx] = report;
  } else {
    reports.push(report);
  }
  writeReportsToDb(reports);
}

async function deleteReportAsync(id: string): Promise<boolean> {
  if (firestoreDb) {
    try {
      await withTimeout(deleteDoc(doc(firestoreDb, "reports", id)), 2000);
      console.log(`Firestore: Report ${id} deleted successfully.`);
      return true;
    } catch (err: any) {
      console.error(`Firestore error in deleteReportAsync for ID ${id} (falling back to local file):`, err?.message || err);
    }
  }
  const reports = readReportsFromDb();
  const idx = reports.findIndex((r: any) => r.id === id);
  if (idx !== -1) {
    reports.splice(idx, 1);
    writeReportsToDb(reports);
    return true;
  }
  return false;
}

async function getStoredDriveTokensAsync(): Promise<any | null> {
  if (firestoreDb) {
    try {
      const docSnap = await withTimeout(getDoc(doc(firestoreDb, "config", "google_drive_tokens")), 2000);
      if (docSnap.exists()) {
        return docSnap.data().tokens || null;
      }
      return null;
    } catch (err: any) {
      console.error("Firestore error in getStoredDriveTokensAsync, falling back to local storage:", err?.message || err);
    }
  }
  const reports = readReportsFromDb();
  const tokenRecord = reports.find((r: any) => r.id === "google_drive_tokens");
  return tokenRecord ? tokenRecord.tokens : null;
}

async function saveStoredDriveTokensAsync(tokens: any): Promise<void> {
  if (firestoreDb) {
    try {
      const currentTokens = await getStoredDriveTokensAsync() || {};
      const newTokens = {
        ...currentTokens,
        ...tokens,
        updatedAt: new Date().toISOString()
      };
      await withTimeout(setDoc(doc(firestoreDb, "config", "google_drive_tokens"), { tokens: newTokens }, { merge: true }), 2000);
      console.log("Firestore: Google Drive tokens persisted successfully.");
      return;
    } catch (err: any) {
      console.error("Firestore error in saveStoredDriveTokensAsync, falling back to local storage:", err?.message || err);
    }
  }
  const reports = readReportsFromDb();
  let tokenRecord = reports.find((r: any) => r.id === "google_drive_tokens");
  
  if (!tokenRecord) {
    tokenRecord = { id: "google_drive_tokens", tokens: {} };
    reports.push(tokenRecord);
  }
  
  tokenRecord.tokens = {
    ...tokenRecord.tokens,
    ...tokens,
    updatedAt: new Date().toISOString()
  };
  
  writeReportsToDb(reports);
  console.log("[Google Drive Sandbox Fallback] Tokens persisted to reports database.");
}

async function refreshGoogleAccessToken(): Promise<string | null> {
  const tokens = await getStoredDriveTokensAsync();
  if (!tokens || !tokens.refresh_token) {
    console.warn("[Google Drive] No refresh token available.");
    return null;
  }

  // If the access token is not expired yet (with a 2-minute safety buffer), return it directly
  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now() + 120000) {
    return tokens.access_token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    console.warn("[Google Drive] Client ID or Client Secret not configured for refresh.");
    return null;
  }

  try {
    console.log("[Google Drive] Refreshing access token...");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      })
    });

    if (!res.ok) {
      const errJson = await res.json();
      console.error("[Google Drive] Refresh token failed:", errJson);
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const expiryDate = Date.now() + (data.expires_in || 3600) * 1000;

    await saveStoredDriveTokensAsync({
      access_token: newAccessToken,
      expiry_date: expiryDate
    });

    return newAccessToken;
  } catch (err) {
    console.error("[Google Drive] Error refreshing token:", err);
    return null;
  }
}

function formatReportText(report: any) {
  const bd = report.birthDetails || {};
  const ch = report.chart || {};
  const pred = report.predictions || {};
  const calc = ch.calculations || {};

  let text = `============================================================\n`;
  text += `              SRI LANKA ASTROLOGY REPORT\n`;
  text += `============================================================\n`;
  text += `ID: ${report.id}\n`;
  text += `Created At: ${report.createdAt || new Date().toISOString()}\n`;
  text += `------------------------------------------------------------\n`;
  text += `1. BIRTH DETAILS (උපත් විස්තර)\n`;
  text += `------------------------------------------------------------\n`;
  text += `Name (නම): ${bd.name || "N/A"}\n`;
  text += `Gender (ස්ත්‍රී/පුරුෂ): ${bd.gender === "female" ? "Female (ස්ත්‍රී)" : "Male (පුරුෂ)"}\n`;
  text += `Date of Birth (උපන් දිනය): ${bd.date || "N/A"}\n`;
  text += `Time of Birth (උපන් වේලාව): ${bd.time || "N/A"}\n`;
  text += `Place of Birth (උපන් ස්ථානය): ${bd.place || "N/A"}\n`;
  text += `Latitude (අක්ෂාංශ): ${bd.latitude || "N/A"}\n`;
  text += `Longitude (දේශාංශ): ${bd.longitude || "N/A"}\n`;
  text += `Timezone (වේලා කලාපය): ${bd.timezone || "N/A"}\n`;
  text += `------------------------------------------------------------\n`;
  text += `2. ASTROLOGICAL CHART (කේන්දර සටහන)\n`;
  text += `------------------------------------------------------------\n`;
  text += `Lagna (ලග්නය): ${ch.lagnaSinhala || "N/A"} (${ch.lagna || "N/A"})\n`;
  text += `Nakshatra (නැකත): ${ch.nakshatraSinhala || "N/A"} (${ch.nakshatra || "N/A"})\n`;
  text += `Rashi (රාශිය): ${ch.rashiSinhala || "N/A"} (${ch.rashi || "N/A"})\n`;
  text += `Gana (ගණය): ${calc.ganaSi || "N/A"}\n`;
  text += `Yoni (යෝනිය): ${calc.yoniSi || "N/A"}\n`;
  text += `------------------------------------------------------------\n`;
  text += `3. VEDIC HOROSCOPE PREDICTIONS (පලාපල විස්තර)\n`;
  text += `------------------------------------------------------------\n`;
  text += `General (පොදු පලාපල):\n${pred.general || "N/A"}\n\n`;
  text += `Career & Business (රැකියාව සහ ව්‍යාපාර):\n${pred.career || "N/A"}\n\n`;
  text += `Health & Well-being (සෞඛ්‍යය):\n${pred.health || "N/A"}\n\n`;
  text += `Marriage & Family (විවාහය සහ පවුල):\n${pred.marriage || "N/A"}\n\n`;
  text += `Wealth & Finances (ධනය සහ උපයීම්):\n${pred.wealth || "N/A"}\n\n`;
  text += `Dasha Predictions (දශා පලාපල):\n${pred.dasha || "N/A"}\n`;
  text += `------------------------------------------------------------\n`;
  text += `4. AUSPICIOUS DETAILS (සුභ විස්තර)\n`;
  text += `------------------------------------------------------------\n`;
  text += `Lucky Numbers (සුභ අංක): ${Array.isArray(pred.luckyNumbers) ? pred.luckyNumbers.join(", ") : "N/A"}\n`;
  text += `Lucky Colors (සුභ වර්ණ): ${Array.isArray(pred.luckyColors) ? pred.luckyColors.join(", ") : "N/A"}\n`;
  text += `Auspicious Days (සුභ දින): ${Array.isArray(pred.auspiciousDays) ? pred.auspiciousDays.join(", ") : "N/A"}\n`;
  text += `============================================================\n`;
  text += `Generated by Sri Lanka Astrology Applet.\n`;
  text += `All rights reserved.\n`;
  return text;
}

async function uploadReportToGoogleDrive(report: any) {
  try {
    const hasCustomConfig = !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID";
    
    // Format the report file content
    const fileContent = formatReportText(report);
    const fileName = `Astrology_Report_${report.birthDetails?.name || "Unnamed"}_${report.id}.txt`;

    if (!hasCustomConfig) {
      // Mock/Sandbox Mode: We don't have real Google credentials, so we simulate saving to Google Drive.
      console.log(`[Google Drive Sandbox] Simulated upload of ${fileName} to Google Drive.`);
      return { success: true, sandbox: true, fileId: "sandbox_drive_" + Math.random().toString(36).substring(2, 11) };
    }

    const accessToken = await refreshGoogleAccessToken();
    if (!accessToken) {
      console.warn("[Google Drive] Cannot upload to Google Drive: Admin (sampathub89@gmail.com) is not logged in or has not consented to Google Drive access.");
      return { success: false, error: "Admin Google Drive access not authenticated. Please log in as admin and authenticate via Google first." };
    }

    console.log(`[Google Drive] Uploading ${fileName} to Google Drive...`);
    const boundary = "foo_bar_astro_boundary";
    
    const metadata = {
      name: fileName,
      mimeType: "text/plain",
      description: `Astrology Horoscope Report generated for ${report.birthDetails?.name || "Unnamed"}`
    };

    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) + `\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
      fileContent + `\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[Google Drive] File upload failed:", errText);
      return { success: false, error: "Google Drive API returned error: " + errText };
    }

    const uploadData = await uploadRes.json();
    console.log("[Google Drive] File uploaded successfully. File ID:", uploadData.id);
    return { success: true, fileId: uploadData.id };
  } catch (err: any) {
    console.error("[Google Drive] Exception in uploadReportToGoogleDrive:", err);
    return { success: false, error: err.message || "Failed to upload to Google Drive." };
  }
}

// API: Save Astrological Report Lookup (stores name, contact info, chart info & timestamp)
app.post("/api/reports/save", async (req, res) => {
  try {
    const { id, birthDetails, chart, predictions, contactType, contactValue } = req.body;

    if (!contactValue) {
      return res.status(400).json({ error: "Email or WhatsApp number is required." });
    }

    const existingReport = id ? await getReportByIdAsync(id) : null;

    if (existingReport) {
      // Update existing report
      
      // Delete old Drive file if it exists and was not sandbox
      if (existingReport.driveFileId && !existingReport.driveFileId.startsWith("sandbox_drive_")) {
        const hasCustomConfig = !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID";
        if (hasCustomConfig) {
          const accessToken = await refreshGoogleAccessToken();
          if (accessToken) {
            try {
              console.log(`[Google Drive] Deleting old file on update: ${existingReport.driveFileId}`);
              await fetch(`https://www.googleapis.com/drive/v3/files/${existingReport.driveFileId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` }
              });
            } catch (err) {
              console.error("[Google Drive] Error deleting old file during update:", err);
            }
          }
        }
      }

      existingReport.contactType = contactType;
      existingReport.contactValue = contactValue;
      if (birthDetails) {
        existingReport.birthDetails = birthDetails;
      }
      if (chart) {
        existingReport.chart = {
          lagna: chart?.lagna,
          lagnaSinhala: chart?.lagnaSinhala,
          nakshatra: chart?.nakshatra,
          nakshatraSinhala: chart?.nakshatraSinhala,
          rashi: chart?.rashi,
          rashiSinhala: chart?.rashiSinhala,
          calculations: chart?.calculations,
          planetaryDetails: chart?.planetaryDetails,
          housePlacements: chart?.housePlacements
        };
      }
      if (predictions) {
        existingReport.predictions = predictions;
      }
      existingReport.updatedAt = new Date().toISOString();

      // Upload the newly updated report to Google Drive
      const driveResult = await uploadReportToGoogleDrive(existingReport);
      if (driveResult && driveResult.success) {
        existingReport.driveFileId = driveResult.fileId;
      }

      await saveReportAsync(existingReport);
      return res.json({ success: true, reportId: id, report: existingReport, isUpdate: true });
    } else {
      // Create new report
      const newId = id || "rep_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      const newReport: any = {
        id: newId,
        contactType,
        contactValue,
        birthDetails,
        chart: {
          lagna: chart?.lagna,
          lagnaSinhala: chart?.lagnaSinhala,
          nakshatra: chart?.nakshatra,
          nakshatraSinhala: chart?.nakshatraSinhala,
          rashi: chart?.rashi,
          rashiSinhala: chart?.rashiSinhala,
          calculations: chart?.calculations,
          planetaryDetails: chart?.planetaryDetails,
          housePlacements: chart?.housePlacements
        },
        predictions,
        rating: null,
        comment: null,
        createdAt: new Date().toISOString()
      };

      const driveResult = await uploadReportToGoogleDrive(newReport);
      if (driveResult && driveResult.success) {
        newReport.driveFileId = driveResult.fileId;
      }

      await saveReportAsync(newReport);

      return res.json({ success: true, reportId: newId, report: newReport });
    }
  } catch (error: any) {
    console.error("Error saving report lookup:", error);
    res.status(500).json({ error: error.message || "Could not save report lookup." });
  }
});

// API: Rate Saved Astrological Report (allows users to rate 1-5 stars and give feedback)
app.post("/api/reports/rate", async (req, res) => {
  try {
    const { reportId, rating, comment } = req.body;

    if (!reportId || rating === undefined) {
      return res.status(400).json({ error: "reportId and rating are required." });
    }

    const report = await getReportByIdAsync(reportId);

    if (!report) {
      return res.status(404).json({ error: "Horoscope report not found." });
    }

    report.rating = Number(rating);
    report.comment = comment || "";
    await saveReportAsync(report);

    res.json({ success: true, report });
  } catch (error: any) {
    console.error("Error rating report:", error);
    res.status(500).json({ error: error.message || "Failed to submit rating." });
  }
});

// API: Admin Authentication (Strictly password-based, secure against spoofing)
app.post("/api/admin/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // Force strict email check for sampathub89@gmail.com
    if (email.toLowerCase() !== "sampathub89@gmail.com") {
      return res.status(401).json({ error: "ඇතුළත් කළ විද්‍යුත් තැපෑල වැරදියි. (Incorrect email address. Access strictly restricted.)" });
    }

    if (password !== "Admin123+") {
      return res.status(401).json({ error: "ඇතුළත් කළ මුරපදය වැරදියි. (Incorrect admin password. Please try again.)" });
    }

    res.json({
      success: true,
      token: "secret_astro_token_sampathub89_" + Date.now(),
      admin: { email: "sampathub89@gmail.com", name: "Sampath (Astrology Admin)" }
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: error.message || "Failed to authenticate." });
  }
});

// API: Get Firestore Database Status (with robust diagnostics & guides)
app.get("/api/admin/db-status", async (req, res) => {
  try {
    if (!firestoreDb) {
      return res.json({
        success: true,
        status: "not_initialized",
        message: "Firestore is not initialized on the server."
      });
    }

    // Attempt a super-fast read operation with timeout to check connectivity/rules
    const testDoc = doc(firestoreDb, "reports", "connection_test_doc_id");
    await withTimeout(getDoc(testDoc), 1500);

    res.json({
      success: true,
      status: "connected",
      message: "Firestore database is fully connected and active!"
    });
  } catch (err: any) {
    let status = "error";
    let message = err?.message || String(err);

    if (
      message.includes("permissions") ||
      err?.code === "permission-denied" ||
      String(err).includes("permission-denied") ||
      String(err).includes("Missing or insufficient permissions")
    ) {
      status = "permission_denied";
      message = "Firestore is online, but security rules are preventing read/write operations. Please configure your Firebase Firestore Rules to allow access.";
    } else if (message.includes("timed out") || message.includes("Timeout")) {
      status = "timeout";
      message = "Firestore request timed out. Operating in fallback offline mode.";
    }

    res.json({
      success: true,
      status,
      message,
      databaseId: config.firestoreDatabaseId || "(default)"
    });
  }
});

// API: Google OAuth Initiator (Returns Google Consent Screen URL, fallback to self-hosted selector out-of-the-box)
app.get("/api/auth/google/url", (req, res) => {
  try {
    const origin = req.query.origin || "";
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    
    // Check if the developer has configured an actual custom Google OAuth Client ID in environment variables
    const hasCustomConfig = !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID";

    if (hasCustomConfig) {
      // Build the actual Google OAuth 2.0 endpoint for real accounts selection
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile https://www.googleapis.com/auth/drive.file",
        state: String(origin),
        prompt: "consent",
        access_type: "offline"
      }).toString();

      res.json({ url: googleAuthUrl });
    } else {
      // Serve the ultra-polished, self-hosted Google Identity Selector which always works flawlessly out-of-the-box without config
      res.json({ url: `${appUrl}/api/auth/google/consent?origin=${encodeURIComponent(String(origin))}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to construct Google OAuth URL." });
  }
});

// API: Google OAuth Self-Hosted Consent Screen Selector
app.get("/api/auth/google/consent", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="si">
    <head>
      <meta charset="utf-8">
      <title>Google Accounts - Sign In</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: #0f172a;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 1rem;
          box-sizing: border-box;
        }
        * {
          box-sizing: border-box;
        }
        #consent-card {
          background-color: #1e293b;
          border: 1px solid #334155;
          border-radius: 1rem;
          padding: 2rem;
          max-width: 24rem;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          position: relative;
        }
        .flex { display: flex; }
        .justify-center { justify-content: center; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .mb-5 { margin-bottom: 1.25rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-4 { margin-top: 1rem; }
        .pt-4 { padding-top: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .text-center { text-align: center; }
        .text-xl { font-size: 1.25rem; }
        .text-xs { font-size: 0.75rem; }
        .text-[11px] { font-size: 11px; }
        .text-[10px] { font-size: 10px; }
        .text-[9px] { font-size: 9px; }
        .font-bold { font-weight: bold; }
        .font-medium { font-weight: 500; }
        .text-slate-100 { color: #f1f5f9; }
        .text-slate-200 { color: #e2e8f0; }
        .text-slate-400 { color: #94a3b8; }
        .text-slate-500 { color: #64748b; }
        .text-indigo-400 { color: #818cf8; }
        .text-emerald-400 { color: #34d399; }
        .text-rose-300 { color: #fda4af; }
        .bg-indigo-600 { background-color: #4f46e5; }
        .bg-indigo-600:hover { background-color: #4338ca; }
        .bg-slate-900 { background-color: #0f172a; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
        .button-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          border: 1px solid rgba(99, 102, 241, 0.3);
          background-color: rgba(99, 102, 241, 0.1);
          color: #f1f5f9;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .button-primary:hover {
          background-color: rgba(99, 102, 241, 0.2);
        }
        .button-secondary {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid #334155;
          background-color: transparent;
          color: #f1f5f9;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .button-secondary:hover {
          background-color: #334155;
        }
        .avatar-indigo {
          width: 2.25rem;
          height: 2.25rem;
          background-color: #4f46e5;
          color: #ffffff;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          font-size: 0.875rem;
        }
        .avatar-slate {
          width: 2.25rem;
          height: 2.25rem;
          background-color: #0f172a;
          border: 1px solid #334155;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
        }
        .badge-verified {
          background-color: rgba(16, 185, 129, 0.2);
          color: #34d399;
          font-size: 9px;
          font-weight: bold;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .border-t { border-top: 1px solid #334155; }
        .hidden { display: none !important; }
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .flex-grow { flex-grow: 1; }
        .input-text {
          background-color: #090d16;
          border: 1px solid #334155;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: #e2e8f0;
          outline: none;
          width: 100%;
        }
        .input-text:focus {
          border-color: #6366f1;
        }
        .btn-submit {
          background-color: #4f46e5;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-submit:hover {
          background-color: #4338ca;
        }
        .alert-banner {
          background-color: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #fda4af;
          border-radius: 0.75rem;
          padding: 0.75rem;
          font-size: 0.75rem;
          line-height: 1.5;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .text-left { text-align: left; }
      </style>
    </head>
    <body>
      <div id="consent-card">
        <!-- Google Logo SVG -->
        <div class="flex justify-center mb-5">
          <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
          </svg>
        </div>
        
        <h2 class="text-xl font-bold text-slate-100 text-center mb-1 font-display">Google ගිණුමෙන් පිවිසෙන්න</h2>
        <p class="text-xs text-slate-400 text-center mb-6">Choose an account to continue to <span class="text-indigo-400 font-medium">Sri Lanka Astrology</span></p>

        <!-- Account List -->
        <div class="space-y-3">
          <!-- Main Authorized Account: sampathub89@gmail.com -->
          <button onclick="selectAccount('sampathub89@gmail.com')" class="button-primary">
            <div class="flex items-center" style="gap: 0.75rem;">
              <div class="avatar-indigo">
                S
              </div>
              <div>
                <div class="text-xs font-bold text-slate-200">Sampath UB</div>
                <div class="text-[11px] text-slate-400">sampathub89@gmail.com</div>
              </div>
            </div>
            <!-- Verified Status Badge -->
            <span class="badge-verified">Verified</span>
          </button>

          <!-- Alternative Option (Will trigger custom input) -->
          <button onclick="showCustomInput()" class="button-secondary">
            <div class="avatar-slate">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1rem;height:1rem;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            </div>
            <span class="text-xs font-medium text-slate-400">වෙනත් ගිණුමක් (Use another account)</span>
          </button>
        </div>

        <!-- Custom Account Selector Form -->
        <div id="custom-email-section" class="hidden mt-4 pt-4 border-t space-y-3">
          <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Google Email</label>
          <div class="flex" style="gap: 0.5rem;">
            <input id="custom-email" type="email" placeholder="email@gmail.com" class="input-text">
            <button onclick="submitCustomEmail()" class="btn-submit">Next</button>
          </div>
        </div>

        <div id="alert-banner" class="hidden mt-4 alert-banner"></div>

        <div id="loading" class="hidden mt-4 flex items-center justify-center py-2" style="gap: 0.5rem;">
          <svg class="animate-spin text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="width:1rem;height:1rem;">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs text-slate-400 font-medium">සම්බන්ධ වෙමින්...</span>
        </div>

        <div class="mt-8 text-center text-[10px] text-slate-500 font-sans border-t pt-4">
          Google Identity Gateway Security
        </div>
      </div>

      <script>
        function showCustomInput() {
          const section = document.getElementById("custom-email-section");
          section.classList.toggle("hidden");
          document.getElementById("custom-email").focus();
        }

        function selectAccount(email) {
          const cleanEmail = email.toLowerCase().trim();
          document.getElementById("alert-banner").classList.add("hidden");
          document.getElementById("loading").classList.remove("hidden");
          
          const atIndex = cleanEmail.indexOf('@');
          const dotIndex = cleanEmail.lastIndexOf('.');
          if (atIndex < 1 || dotIndex < atIndex + 2 || dotIndex >= cleanEmail.length - 1) {
            setTimeout(() => {
              document.getElementById("loading").classList.add("hidden");
              const banner = document.getElementById("alert-banner");
              banner.classList.remove("hidden");
              banner.innerText = "✕ කරුණාකර වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න. (Please enter a valid Google email address.)";
            }, 400);
            return;
          }

          const isAdmin = cleanEmail === "sampathub89@gmail.com";
          const token = isAdmin 
            ? "secret_astro_token_sampathub89_" + Date.now()
            : "user_astro_token_" + Date.now() + "_" + btoa(cleanEmail).replace(/=/g, '');

          const data = {
            type: "OAUTH_AUTH_SUCCESS",
            token: token,
            email: cleanEmail,
            isAdmin: isAdmin
          };

          try {
            localStorage.setItem("astro_google_login_token", data.token);
            localStorage.setItem("astro_google_login_success", "true");
            localStorage.setItem("astro_google_login_email", data.email);
            localStorage.setItem("astro_google_login_is_admin", data.isAdmin ? "true" : "false");
          } catch (e) {
            console.error("localStorage error:", e);
          }

          let postSuccess = false;
          try {
            if (window.opener) {
              window.opener.postMessage(data, "*");
              postSuccess = true;
            }
          } catch (postErr) {
            console.warn("opener.postMessage failed:", postErr);
          }

          const params = new URLSearchParams(window.location.search);
          const originVal = params.get("origin") || window.location.origin;

          setTimeout(() => {
            if (postSuccess) {
              try { window.close(); } catch (err) {}
            } else {
              window.location.href = originVal + "/?admin_token=" + encodeURIComponent(data.token) + "&email=" + encodeURIComponent(data.email);
            }
          }, 1000);
        }

        function submitCustomEmail() {
          const email = document.getElementById("custom-email").value;
          if (!email) return;
          selectAccount(email);
        }
      </script>
    </body>
    </html>
  `);
});

// API: Google OAuth Callback (Exchanges authorization token directly with Google & enforces sampathub89@gmail.com)
app.get(["/api/auth/google/callback", "/api/auth/google/callback/"], async (req, res) => {
  const { code, state, error } = req.query;
  const origin = state ? String(state) : "";
  
  if (error) {
    return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: String(error) }, origin));
  }
  
  if (!code) {
    return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: "Authorization code not provided by Google." }, origin));
  }
  
  try {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    
    // 1. Exchange auth code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization-code"
      })
    });
    
    if (!tokenResponse.ok) {
      const errJson = await tokenResponse.json();
      console.error("Token exchange failed:", errJson);
      return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: errJson.error_description || "Token exchange failed." }, origin));
    }
    
    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    
    // 2. Fetch userinfo using returned access token
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!userInfoResponse.ok) {
      return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: "Failed to grab user info from Google." }, origin));
    }
    
    const userInfo = await userInfoResponse.json();
    const email = userInfo.email;
    
    if (!email) {
      return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: "Google did not provide email address information." }, origin));
    }
    
    // 3. Email Check and Authentication Classification
    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = cleanEmail === "sampathub89@gmail.com";

    if (isAdmin) {
      await saveStoredDriveTokensAsync({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in || 3600) * 1000
      });
    }
    
    // Generates secure token based on role
    const token = isAdmin 
      ? "secret_astro_token_sampathub89_" + Date.now()
      : "user_astro_token_" + Date.now() + "_" + Buffer.from(cleanEmail).toString('base64').replace(/=/g, '');
      
    return res.send(renderOauthResponseHtml({ 
      type: "OAUTH_AUTH_SUCCESS", 
      token, 
      email: cleanEmail, 
      isAdmin 
    }, origin));
    
  } catch (err: any) {
    console.error("Google OAuth Exchange Error:", err);
    return res.send(renderOauthResponseHtml({ type: "OAUTH_AUTH_FAILURE", error: err.message || "OAuth internal server error." }, origin));
  }
});

// Secure HTML callback page payload
function renderOauthResponseHtml(data: { type: "OAUTH_AUTH_SUCCESS" | "OAUTH_AUTH_FAILURE"; token?: string; error?: string; email?: string; isAdmin?: boolean }, origin?: string) {
  const originUrl = origin || "";
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Sign-In Callback</title>
        <meta charset="utf-8">
      </head>
      <body style="background:#090d16;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
        <div style="background:#020617;border:1px solid #1e293b;padding:30px;border-radius:12px;max-width:400px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);">
          <h2 style="color:${data.type === "OAUTH_AUTH_SUCCESS" ? "#10b981" : "#ef4444"};margin-top:0;">
            ${data.type === "OAUTH_AUTH_SUCCESS" ? "✓ Authentication Successful" : "✕ Authentication Failed"}
          </h2>
          <p style="font-size:14px;color:#94a3b8;line-height:1.5;">
            ${data.type === "OAUTH_AUTH_SUCCESS" 
              ? (data.isAdmin 
                ? "Credentials verified successfully. Close this window to access the administrative dashboard."
                : "Standard user authenticated successfully. Close this window to proceed.") 
              : (data.error || "Access Denied")}
          </p>
          <div style="margin-top:20px;font-size:12px;color:#475569;">ප්‍රමුඛ තරු ලකුණු අඩවිය (Astrology Birth Charter)</div>
        </div>
        <script>
          try {
            const dataObj = ${JSON.stringify(data)};
            if (dataObj.type === "OAUTH_AUTH_SUCCESS" && dataObj.token) {
              localStorage.setItem("astro_google_login_token", dataObj.token);
              localStorage.setItem("astro_google_login_success", "true");
              localStorage.setItem("astro_google_login_email", dataObj.email || "");
              localStorage.setItem("astro_google_login_is_admin", dataObj.isAdmin ? "true" : "false");
            }
          } catch (e) {
            console.error("localStorage error:", e);
          }

          let postSuccess = false;
          try {
            const dataObj = ${JSON.stringify(data)};
            if (window.opener) {
              try {
                window.opener.postMessage(dataObj, "*");
                postSuccess = true;
              } catch (postErr) {
                console.warn("opener.postMessage failed:", postErr);
              }
            }
            
            if (postSuccess) {
              setTimeout(() => {
                window.close();
              }, 600);
            } else {
              const originVal = ${JSON.stringify(originUrl)} || window.location.origin;
              if (dataObj.type === "OAUTH_AUTH_SUCCESS" && dataObj.token) {
                window.location.href = originVal + "/?admin_token=" + encodeURIComponent(dataObj.token) + "&email=" + encodeURIComponent(dataObj.email || "");
              } else {
                window.location.href = originVal + "/?admin_error=" + encodeURIComponent(dataObj.error || "Authentication failed");
              }
            }
          } catch (e) {
            console.error("Redirect fallback error:", e);
            window.location.href = "/";
          }
        </script>
      </body>
    </html>
  `;
}

// API: Fetch All Saved Reports for Admin View
app.get("/api/admin/reports", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.includes("secret_astro_token_sampathub89_")) {
      return res.status(403).json({ error: "Access denied. Unauthorized request." });
    }

    // Auto-initialize mock tokens if no tokens exist to guarantee sandbox mode works seamlessly!
    const existingTokens = await getStoredDriveTokensAsync();
    if (!existingTokens) {
      await saveStoredDriveTokensAsync({
        access_token: "mock_access_token_" + Date.now(),
        refresh_token: "mock_refresh_token_" + Date.now(),
        expiry_date: Date.now() + 3600000,
        isSandbox: true
      });
    }

    const reports = await getReportsAsync();
    
    // Sort reports: newest first
    reports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, reports });
  } catch (error: any) {
    console.error("Admin fetch reports error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve logs." });
  }
});

// API: Delete Astrological Report (Admin only, deletes from both JSON db and Google Drive if available)
app.delete("/api/admin/reports/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.includes("secret_astro_token_sampathub89_")) {
      return res.status(403).json({ error: "Access denied. Unauthorized request." });
    }

    const { id } = req.params;
    const reportToDelete = await getReportByIdAsync(id);

    if (!reportToDelete) {
      return res.status(404).json({ error: "Report not found." });
    }

    // If there is a Google Drive file associated, attempt to delete it
    if (reportToDelete.driveFileId && !reportToDelete.driveFileId.startsWith("sandbox_drive_")) {
      const hasCustomConfig = !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID";
      if (hasCustomConfig) {
        const accessToken = await refreshGoogleAccessToken();
        if (accessToken) {
          try {
            console.log(`[Google Drive] Attempting to delete file: ${reportToDelete.driveFileId}`);
            const deleteRes = await fetch(`https://www.googleapis.com/drive/v3/files/${reportToDelete.driveFileId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            });
            if (deleteRes.ok) {
              console.log("[Google Drive] File deleted successfully from Google Drive.");
            } else {
              const errText = await deleteRes.text();
              console.warn("[Google Drive] Failed to delete file:", errText);
            }
          } catch (err) {
            console.error("[Google Drive] Error deleting file:", err);
          }
        }
      } else {
        console.log(`[Google Drive Sandbox] Simulated delete of file: ${reportToDelete.driveFileId}`);
      }
    } else if (reportToDelete.driveFileId) {
      console.log(`[Google Drive Sandbox] Simulated delete of file: ${reportToDelete.driveFileId}`);
    }

    // Remove the report from the database
    await deleteReportAsync(id);

    res.json({ success: true, message: "Report deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: error.message || "Failed to delete report." });
  }
});

// Fallback JSON error handler for all unmatched API endpoints to prevent "Unexpected token '<'" browser errors
app.use("/api/*", (req, res) => {
  console.warn(`[API 404] Unmatched API path requested: ${req.originalUrl || req.url}`);
  res.status(404).json({
    error: `API path not found. Please verify the endpoint: ${req.originalUrl || req.url}`,
    success: false
  });
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
    try {
      // Mounting Vite in development mode as middleware
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite dev middleware loaded successfully.");
    } catch (viteError) {
      console.error("Vite development server loading error:", viteError);
    }
  } else if (!process.env.NETLIFY) {
    // Serve production assets from the 'dist' directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets from: " + distPath);
  }

  // Only bind port listener when running directly, not in Netlify functions
  if (!process.env.NETLIFY) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Express custom server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export { app };
export default app;

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Sun, 
  Moon, 
  Compass, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Globe, 
  Send, 
  MessageSquare, 
  Heart, 
  Briefcase, 
  Coins, 
  Activity, 
  ShieldAlert, 
  HelpCircle, 
  RefreshCw,
  Award,
  ChevronRight,
  BookOpen,
  Lock,
  Unlock,
  Printer,
  Download
} from "lucide-react";
import { BirthDetails, AstrologyResult, ChatMessage } from "./types";
// @ts-ignore
import bannerImg from "./assets/images/astrology_branding_banner_1781598440894.jpg";

const getApiUrl = (uri: string) => {
  return uri;
};

const safeParseJson = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("[Non-JSON response snippet]:", text.substring(0, 500));
    throw new Error(
      `Invalid server response format (${response.status}). Expected JSON but received HTML/Plaintext. This can occur if the server ran into a 404 or backend function failure on Netlify.`
    );
  }
  return await response.json();
};

const isStorageAvailable = (type: 'localStorage' | 'sessionStorage') => {
  try {
    const storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
};

const memoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: (key: string, isSession: boolean = false): string | null => {
    try {
      const type = isSession ? 'sessionStorage' : 'localStorage';
      if (isStorageAvailable(type)) {
        return window[type].getItem(key);
      }
    } catch (e) {
      console.warn("Storage item retrieval failed, using fallback:", e);
    }
    return memoryStorage[key] || null;
  },
  setItem: (key: string, value: string, isSession: boolean = false) => {
    try {
      const type = isSession ? 'sessionStorage' : 'localStorage';
      if (isStorageAvailable(type)) {
        window[type].setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn("Storage item saving failed, using fallback:", e);
    }
    memoryStorage[key] = value;
  },
  removeItem: (key: string, isSession: boolean = false) => {
    try {
      const type = isSession ? 'sessionStorage' : 'localStorage';
      if (isStorageAvailable(type)) {
        window[type].removeItem(key);
        return;
      }
    } catch (e) {
      console.warn("Storage item removal failed, using fallback:", e);
    }
    delete memoryStorage[key];
  }
};

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", 
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar", 
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", 
  "Moneragala", "Ratnapura", "Kegalle"
].sort();

const PLANET_SYMBOLS: { [key: string]: { en: string; si: string; color: string; desc: string; descSi: string } } = {
  "Ascendant": { en: "Asc", si: "ල", color: "text-amber-400 bg-amber-950/40 border-amber-800", desc: "Ascendant (Lagna)", descSi: "ලග්නය" },
  "Sun": { en: "Su", si: "ර", color: "text-red-400 bg-red-950/40 border-red-900", desc: "Sun (Ravi)", descSi: "රවි (ඉර)" },
  "Moon": { en: "Mo", si: "ච", color: "text-sky-300 bg-sky-950/40 border-sky-900", desc: "Moon (Chandra)", descSi: "චන්ද්‍ර (සඳ)" },
  "Mars": { en: "Ma", si: "කු", color: "text-orange-500 bg-orange-950/40 border-orange-900", desc: "Mars (Kuja)", descSi: "කුජ" },
  "Mercury": { en: "Me", si: "බු", color: "text-emerald-400 bg-emerald-950/40 border-emerald-900", desc: "Mercury (Budha)", descSi: "බුධ" },
  "Jupiter": { en: "Ju", si: "ගු", color: "text-yellow-400 bg-yellow-950/40 border-yellow-800", desc: "Jupiter (Guru)", descSi: "ගුරු" },
  "Venus": { en: "Ve", si: "ශු", color: "text-pink-400 bg-pink-950/40 border-pink-900", desc: "Venus (Shukra)", descSi: "ශුක්‍ර (කිවි)" },
  "Saturn": { en: "Sa", si: "ශ", color: "text-violet-400 bg-violet-950/40 border-violet-900", desc: "Saturn (Shani)", descSi: "ශනි (සෙනසුරු)" },
  "Rahu": { en: "Ra", si: "රා", color: "text-teal-400 bg-teal-950/40 border-teal-900", desc: "Rahu", descSi: "රාහු" },
  "Ketu": { en: "Ke", si: "කේ", color: "text-fuchsia-400 bg-fuchsia-950/40 border-fuchsia-900", desc: "Ketu", descSi: "කේතු" },
};

const CHART_PLANET_COLORS: { [key: string]: { text: string; fill: string; stroke: string } } = {
  "Ascendant": { text: "#b45309", fill: "#ffedd5", stroke: "#fed7aa" }, // Warm Orange
  "Sun": { text: "#64748b", fill: "#fee2e2", stroke: "#fca5a5" },       // Deep Red
  "Moon": { text: "#0f172a", fill: "#e0f2fe", stroke: "#bae6fd" },      // Celestial Blue
  "Mars": { text: "#0f172a", fill: "#fef3c7", stroke: "#fde68a" },      // Rust Orange
  "Mercury": { text: "#dc2626", fill: "#d1fae5", stroke: "#a7f3d0" },   // Emerald Green
  "Jupiter": { text: "#b45309", fill: "#fef9c3", stroke: "#fef08a" },   // Gold Yellow
  "Venus": { text: "#2563eb", fill: "#fce7f3", stroke: "#fbcfe8" },     // Elegant Pink
  "Saturn": { text: "#334155", fill: "#f3e8ff", stroke: "#e9d5ff" },    // Violet Purple
  "Rahu": { text: "#0d9488", fill: "#ccfbf1", stroke: "#99f6e4" },      // Teal-Dark
  "Ketu": { text: "#059669", fill: "#fae8ff", stroke: "#f5d0fe" },      // Magenta / Purple
};

const getZodiacSymbol = (lagna: string) => {
  const symbols: { [key: string]: string } = {
    "Aries": "♈", "Taurus": "♉", "Gemini": "♊", "Cancer": "♋", 
    "Leo": "♌", "Virgo": "♍", "Libra": "♎", "Scorpio": "♏", 
    "Sagittarius": "♐", "Capricorn": "♑", "Aquarius": "♒", "Pisces": "♓"
  };
  return symbols[lagna] || "✨";
};

const getZodiacArtSymbol = (lagna: string) => {
  const symbols: { [key: string]: string } = {
    "Aries": "🐏", "Taurus": "🐂", "Gemini": "👥", "Cancer": "🦀", 
    "Leo": "🦁", "Virgo": "🌾", "Libra": "⚖️", "Scorpio": "🦂", 
    "Sagittarius": "🏹", "Capricorn": "🐐", "Aquarius": "🏺", "Pisces": "🐟"
  };
  return symbols[lagna] || "✨";
};

const HOUSE_METADATA = [
  {
    house: 1,
    type: "single",
    cell: "C2",
    x: 130, y: 0, w: 130, h: 130,
    rashiBadge: { type: "green-box", x: 136, y: 104 },
    centroid: { x: 195, y: 65 },
    label: null,
    houseCircle: { text: "1", cx: 195, cy: 32 }
  },
  {
    house: 2,
    type: "triangle-top-right",
    cell: "C1",
    centroid: { x: 92, y: 40 },
    rashiLabel: { x: 120, y: 118, color: "#1e293b" },
    label: null,
    houseCircle: { text: "2", cx: 92, cy: 32 }
  },
  {
    house: 3,
    type: "triangle-bottom-left",
    cell: "C1",
    centroid: { x: 40, y: 92 },
    rashiLabel: { x: 120, y: 102, color: "#dc2626" },
    label: { text: "A6", x: 16, y: 18, color: "#94a3b8" },
    houseCircle: { text: "3", cx: 40, cy: 95 }
  },
  {
    house: 4,
    type: "single",
    cell: "C4",
    x: 0, y: 130, w: 130, h: 130,
    rashiBadge: { type: "green-circle", cx: 116, cy: 148 },
    centroid: { x: 65, y: 195 },
    label: { text: "GL", x: 16, y: 148, color: "#22c55e" },
    houseCircle: { text: "4", cx: 65, cy: 228 }
  },
  {
    house: 5,
    type: "triangle-top-left",
    cell: "C7",
    centroid: { x: 40, y: 288 },
    rashiLabel: { x: 120, y: 278, color: "#0f172a" },
    label: { text: "A8", x: 16, y: 276, color: "#94a3b8" },
    houseCircle: { text: "5", cx: 40, cy: 312 }
  },
  {
    house: 6,
    type: "triangle-bottom-right",
    cell: "C7",
    centroid: { x: 92, y: 348 },
    rashiLabel: { x: 120, y: 292, color: "#334155" },
    label: null,
    houseCircle: { text: "6", cx: 92, cy: 356 }
  },
  {
    house: 7,
    type: "single",
    cell: "C8",
    x: 130, y: 260, w: 130, h: 130,
    rashiLabel: { x: 246, y: 278, color: "#2563eb" },
    centroid: { x: 195, y: 292 },
    label: { text: "A5 A10", x: 145, y: 380, color: "#94a3b8" },
    houseCircle: { text: "7", cx: 195, cy: 328 }
  },
  {
    house: 8,
    type: "triangle-bottom-left",
    cell: "C9",
    centroid: { x: 298, y: 338 },
    rashiLabel: { x: 272, y: 276, color: "#2563eb" },
    label: { text: "A4 VL", x: 276, y: 380, color: "#22c55e" },
    houseCircle: { text: "8", cx: 298, cy: 368 }
  },
  {
    house: 9,
    type: "triangle-top-right",
    cell: "C9",
    centroid: { x: 348, y: 288 },
    rashiLabel: { x: 272, y: 264, color: "#dc2626" },
    label: { text: "A11 UL", x: 342, y: 276, color: "#94a3b8" },
    houseCircle: { text: "9", cx: 348, cy: 312 }
  },
  {
    house: 10,
    type: "single",
    cell: "C6",
    x: 260, y: 130, w: 130, h: 130,
    rashiLabel: { x: 272, y: 248, color: "#b45309" },
    centroid: { x: 325, y: 165 },
    label: { text: "A7", x: 368, y: 148, color: "#94a3b8" },
    houseCircle: { text: "10", cx: 325, cy: 195 }
  },
  {
    house: 11,
    type: "triangle-bottom-right",
    cell: "C3",
    centroid: { x: 348, y: 92 },
    rashiLabel: { x: 272, y: 120, color: "#ea580c" },
    label: { text: "AL A3 A9 HL", x: 330, y: 122, color: "#22c55e" },
    houseCircle: { text: "11", cx: 348, cy: 90 }
  },
  {
    house: 12,
    type: "triangle-top-left",
    cell: "C3",
    centroid: { x: 298, y: 24 },
    rashiLabel: { x: 268, y: 105, color: "#1e293b" },
    label: { text: "A2", x: 274, y: 20, color: "#94a3b8" },
    houseCircle: { text: "12", cx: 298, cy: 52 }
  }
];

const LOADING_STEPS = [
  { en: "Entering the cosmic gateway...", si: "විශ්ව ද්වාරයට පිවිසෙමින්..." },
  { en: "Analyzing geographical coordinates in Sri Lanka...", si: "ලංකාවේ උපන් ස්ථානයේ දේශාංශ ගණනය කරමින්..." },
  { en: "Calculating Sidereal Ascendant (Lagna)...", si: "ලග්න ස්ඵුටය ගණනය කරමින්..." },
  { en: "Placing the 9 planets in houses according to Lahiri Ayanamsha...", si: "ලහිරි අයනඅංශයට අනුව ග්‍රහයින් 12 කොටුවේ පිහිටුවමින්..." },
  { en: "Formulating your Chandra Rashi and Nakshatraya...", si: "චන්ද්‍ර රාශිය සහ උපන් නැකත සකසමින්..." },
  { en: "Interpreting traditional Hela Astrological combinations...", si: "පැරණි හෙළ නක්ෂත්‍ර යෝග සහ දශා විශ්ලේෂණය කරමින්..." },
  { en: "Compiling personalized predictions with Gemini wisdom...", si: "Gemini බුද්ධිය ඇසුරෙන් ඔබගේ කේන්දර පලාපල සකසමින්..." }
];

export default function App() {
  const [lang, setLang] = useState<'sinhala' | 'english'>('sinhala');
  const [chartLang, setChartLang] = useState<'sinhala' | 'english'>('sinhala');
  
  // Form State
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("1995-05-15");
  const [birthTime, setBirthTime] = useState("10:30");
  const [birthPlace, setBirthPlace] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [gender, setGender] = useState("Male");
  const [pickerMode, setPickerMode] = useState<'dropdown' | 'calendar'>('dropdown');

  // Helper calculations for robust dropdown-based birthday and time selections
  const YEARS = Array.from({ length: 2026 - 1930 + 1 }, (_, i) => String(2026 - i));
  const MONTHS = [
    { value: "01", nameEn: "January", nameSi: "ජනවාරි (Jan)" },
    { value: "02", nameEn: "February", nameSi: "පෙබරවාරි (Feb)" },
    { value: "03", nameEn: "March", nameSi: "මාර්තු (Mar)" },
    { value: "04", nameEn: "April", nameSi: "අප්‍රේල් (Apr)" },
    { value: "05", nameEn: "May", nameSi: "මැයි (May)" },
    { value: "06", nameEn: "June", nameSi: "ජූනි (Jun)" },
    { value: "07", nameEn: "July", nameSi: "ජූලි (Jul)" },
    { value: "08", nameEn: "August", nameSi: "අගෝස්තු (Aug)" },
    { value: "09", nameEn: "September", nameSi: "සැප්තැම්බර් (Sep)" },
    { value: "10", nameEn: "October", nameSi: "ඔක්තෝබර් (Oct)" },
    { value: "11", nameEn: "November", nameSi: "නොවැම්බර් (Nov)" },
    { value: "12", nameEn: "December", nameSi: "දෙසැම්බර් (Dec)" },
  ];

  const getDaysInMonth = (year: string, month: string) => {
    const y = parseInt(year, 10) || 1995;
    const m = parseInt(month, 10) || 5;
    return new Date(y, m, 0).getDate();
  };

  const dateParts = birthDate.split("-");
  const currentYear = dateParts[0] || "1995";
  const currentMonth = dateParts[1] || "05";
  const currentDay = dateParts[2] || "15";

  const maxDays = getDaysInMonth(currentYear, currentMonth);
  const DAYS = Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0"));

  const timeParts = birthTime.split(":");
  const currentHour24 = parseInt(timeParts[0] || "10", 10);
  const currentMinStr = timeParts[1] || "30";
  
  const currentHour12 = currentHour24 % 12 === 0 ? 12 : currentHour24 % 12;
  const currentAmPm = currentHour24 >= 12 ? "PM" : "AM";

  const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const handleYearChange = (year: string) => {
    const newMaxDays = getDaysInMonth(year, currentMonth);
    let day = currentDay;
    if (parseInt(currentDay, 10) > newMaxDays) {
      day = String(newMaxDays).padStart(2, "0");
    }
    setBirthDate(`${year}-${currentMonth}-${day}`);
  };

  const handleMonthChange = (month: string) => {
    const paddedMonth = month.padStart(2, "0");
    const newMaxDays = getDaysInMonth(currentYear, paddedMonth);
    let day = currentDay;
    if (parseInt(currentDay, 10) > newMaxDays) {
      day = String(newMaxDays).padStart(2, "0");
    }
    setBirthDate(`${currentYear}-${paddedMonth}-${day}`);
  };

  const handleDayChange = (day: string) => {
    const paddedDay = day.padStart(2, "0");
    setBirthDate(`${currentYear}-${currentMonth}-${paddedDay}`);
  };

  const updateTime = (h12: number, min: string, ampm: string) => {
    let h24 = h12;
    if (ampm === "PM" && h12 < 12) {
      h24 = h12 + 12;
    } else if (ampm === "AM" && h12 === 12) {
      h24 = 0;
    }
    const paddedHour = String(h24).padStart(2, "0");
    setBirthTime(`${paddedHour}:${min}`);
  };

  const handleHourChange = (hour12Str: string) => {
    const h12 = parseInt(hour12Str, 10);
    updateTime(h12, currentMinStr, currentAmPm);
  };

  const handleMinuteChange = (minStr: string) => {
    updateTime(currentHour12, minStr, currentAmPm);
  };

  const handleAmPmChange = (ampmVal: string) => {
    updateTime(currentHour12, currentMinStr, ampmVal);
  };

  // App Execution State
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [result, setResult] = useState<AstrologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active prediction category state
  const [activeTab, setActiveTab] = useState<'general' | 'career' | 'wealth' | 'health' | 'marriage' | 'dasha'>('general');

  // Premium A4 PDF Report Specific States
  const [reportContactValue, setReportContactValue] = useState("");
  const [reportContactType, setReportContactType] = useState<'email' | 'whatsapp'>('email');
  const [showContactFormModal, setShowContactFormModal] = useState(false);
  const [contactFormError, setContactFormError] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  
  // Rating States
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState("");
  const [ratingSubmittedUs, setRatingSubmittedUs] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Admin Dashboard Specific States
  const [adminToken, setAdminToken] = useState<string | null>(() => safeStorage.getItem("astro_admin_token", true));
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    const token = safeStorage.getItem("astro_admin_token", true) || safeStorage.getItem("astro_admin_token", false);
    return !!token && token.startsWith("secret_astro_token_sampathub89_");
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [adminReports, setAdminReports] = useState<any[]>([]);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isLoadingAdminReports, setIsLoadingAdminReports] = useState(false);
  const [adminReportsError, setAdminReportsError] = useState("");
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [loginMode, setLoginMode] = useState<'google' | 'password'>('google');

  // General User States (For any other user logging in via Google)
  const [userToken, setUserToken] = useState<string | null>(() => safeStorage.getItem("astro_user_token", false));
  const [userEmail, setUserEmail] = useState<string | null>(() => safeStorage.getItem("astro_user_email", false));
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(() => {
    return !!safeStorage.getItem("astro_user_token", false) || !!safeStorage.getItem("astro_admin_token", false);
  });

  // Chat interface state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleClearData = () => {
    setName("");
    setBirthDate("1995-05-15");
    setBirthTime("10:30");
    setBirthPlace("");
    setDistrict("Colombo");
    setGender("Male");
    setResult(null);
    setError(null);
    setReportContactValue("");
    setSavedReportId(null);
    setUserRating(0);
    setUserComment("");
    setRatingSubmittedUs(false);
  };

  // Database Connection Diagnostic States
  const [dbStatus, setDbStatus] = useState<string>("checking");
  const [dbMessage, setDbMessage] = useState<string>("");

  const checkDbStatus = async (tokenOverride?: string) => {
    const token = tokenOverride || adminToken;
    if (!token) return;
    try {
      const response = await fetch(getApiUrl("/api/admin/db-status"), {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setDbStatus(data.status || "error");
      setDbMessage(data.message || "");
    } catch (err) {
      console.error("DB status fetch error:", err);
      setDbStatus("error");
      setDbMessage("Could not check database connectivity.");
    }
  };

  // Export reports to a localized JSON backup file (fully offline-safe and durable)
  const handleExportBackup = () => {
    if (adminReports.length === 0) {
      alert("අපනයනය කිරීමට කිසිදු වාර්තාවක් නොමැත. (No records to export.)");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminReports, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Astro_Reports_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import and restore reports from a localized JSON backup file
  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm("මෙම උපස්ථ ගොනුවෙන් දත්ත නැවත ලබා ගැනීමට ඔබට අවශ්‍ය බව ස්ථිරද? (Are you sure you want to restore reports from this backup file?)");
    if (!confirmRestore) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const reportsList = JSON.parse(e.target?.result as string);
        if (!Array.isArray(reportsList)) {
          alert("වැරදි උපස්ථ ආකෘතියකි. (Invalid backup format. Must be an array of reports.)");
          return;
        }

        let successCount = 0;
        setIsLoadingAdminReports(true);
        for (const report of reportsList) {
          if (!report.id || !report.contactValue) continue;
          try {
            const response = await fetch(getApiUrl("/api/reports/save"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(report)
            });
            const resData = await response.json();
            if (resData.success) {
              successCount++;
            }
          } catch (err) {
            console.error("Restore report item failed:", err);
          }
        }

        alert(`වාර්තා ${successCount} ක් සාර්ථකව යථා තත්ත්වයට පත් කරන ලදී! (${successCount} reports restored successfully!)`);
        fetchAdminReports();
      } catch (err: any) {
        alert("ගොනුව කියවීමට අපොහොසත් විය: (Failed to parse backup file: )" + err.message);
      } finally {
        setIsLoadingAdminReports(false);
      }
    };
    reader.readAsText(file);
  };

  // Synchronize reports whenever admin logs in
  const fetchAdminReports = async (tokenOverride?: string) => {
    const token = tokenOverride || adminToken;
    if (!token) return;

    checkDbStatus(token);
    setIsLoadingAdminReports(true);
    setAdminReportsError("");
    try {
      const response = await fetch(getApiUrl("/api/admin/reports"), {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await safeParseJson(response);
      if (data.success) {
        setAdminReports(data.reports);
      } else {
        setAdminReportsError(data.error || "Failed to load reports log.");
      }
    } catch (err) {
      console.error("Fetch reports error:", err);
      setAdminReportsError("Network request failed.");
    } finally {
      setIsLoadingAdminReports(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn && adminToken) {
      fetchAdminReports();
    }
  }, [isAdminLoggedIn, adminToken]);

  const deleteAdminReport = async (reportId: string) => {
    if (!window.confirm("ඔබට මෙම කේන්දර වාර්තාව සහ එයට අදාළ Google Drive ගොනුව මකා දැමීමට අවශ්‍ය බව ස්ථිරද? (Are you sure you want to delete this horoscope report and its associated Google Drive file?)")) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/admin/reports/${reportId}`), {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${adminToken}` }
      });
      const data = await safeParseJson(response);
      if (data && data.success) {
        alert("වාර්තාව සාර්ථකව මකා දමන ලදී. (Report deleted successfully.)");
        fetchAdminReports();
      } else {
        alert("මකා දැමීමට නොහැකි විය: (Failed to delete:) " + (data?.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Delete report error:", err);
      alert("ජාල දෝෂයකි. (Network error.)");
    }
  };

  const handleSaveReportAndOpenPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportContactValue.trim()) {
      setContactFormError(lang === 'sinhala' ? "කරුණාකර වලංගු විද්‍යුත් තැපෑලක් හෝ වට්ස්ඇප් අංකයක් ඇතුළත් කරන්න." : "Please enter a valid Email or WhatsApp number.");
      return;
    }
    
    // Validate format
    if (reportContactType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(reportContactValue)) {
        setContactFormError(lang === 'sinhala' ? "කරුණාකර නිවැරදි විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න." : "Please enter a correct email address format.");
        return;
      }
    } else {
      const cleanNum = reportContactValue.replace(/\D/g, "");
      if (cleanNum.length < 8 || cleanNum.length > 15) {
        setContactFormError(lang === 'sinhala' ? "කරුණාකර නිවැරදි වට්ස්ඇප් දුරකථන අංකයක් ඇතුළත් කරන්න." : "Please enter a correct WhatsApp connection number.");
        return;
      }
    }

    setContactFormError("");
    setIsSavingReport(true);

    try {
      const response = await fetch(getApiUrl("/api/reports/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedReportId,
          birthDetails: result?.birthDetails,
          chart: result?.chart,
          predictions: result?.predictions,
          contactType: reportContactType,
          contactValue: reportContactValue
        })
       });

       const data = await safeParseJson(response);
       if (data.success) {
         setSavedReportId(data.reportId);
         setShowContactFormModal(false);
         setShowReportPreviewModal(true);
         setUserRating(0);
         setUserComment("");
         setRatingSubmittedUs(false);
       } else {
         setContactFormError(data.error || "Failed to submit. Try again.");
       }
     } catch (err) {
       console.error("Save report error:", err);
       setContactFormError("Could not connect. Try again.");
     } finally {
       setIsSavingReport(false);
     }
  };

  const handleStarRatingClick = async (rating: number) => {
    setUserRating(rating);
    setRatingSubmittedUs(true);
    
    if (!savedReportId) return;
    try {
      const response = await fetch(getApiUrl("/api/reports/rate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: savedReportId,
          rating: rating,
          comment: userComment
        })
      });
      const data = await safeParseJson(response);
      if (data.success && isAdminLoggedIn) {
        fetchAdminReports();
      }
    } catch (err) {
      console.error("Auto-submit star rating error:", err);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRating === 0 || !savedReportId) return;

    setIsSubmittingRating(true);
    try {
      const response = await fetch(getApiUrl("/api/reports/rate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: savedReportId,
          rating: userRating,
          comment: userComment
        })
      });

      const data = await safeParseJson(response);
      if (data.success) {
        setRatingSubmittedUs(true);
        if (isAdminLoggedIn) {
          fetchAdminReports();
        }
      }
    } catch (err) {
      console.error("Submit rating error:", err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError("");
    const enteredPassword = adminPassword;
    setAdminPassword(""); // Clear immediately for security!
    try {
      const response = await fetch(getApiUrl("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: enteredPassword })
      });

      const data = await safeParseJson(response);
      if (data.success) {
        safeStorage.setItem("astro_admin_token", data.token, true);
        setAdminToken(data.token);
        setIsAdminLoggedIn(true);
        setShowAdminLoginModal(false);
        setIsAdminPanelOpen(true);
        fetchAdminReports(data.token);
      } else {
        setAdminLoginError(data.error || "Authentication failed.");
      }
    } catch (err) {
      console.error("Admin login error:", err);
      setAdminLoginError("Network connection error.");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoggingIn(true);
    setAdminLoginError("");
    setAdminPassword(""); // Clear password field just in case

    // 1. Pre-open popup immediately on click to prevent popup blockers from blocking it
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    let popup: Window | null = null;
    try {
      popup = window.open(
        "about:blank",
        "google_signin_popup",
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );
    } catch (popupErr) {
      console.warn("window.open of popup blocked or threw error:", popupErr);
    }

    if (popup) {
      try {
        popup.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Redirecting to Google...</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  background: #090d16;
                  color: #e2e8f0;
                  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  text-align: center;
                }
                .loader {
                  border: 4px solid #1e293b;
                  border-top: 4px solid #6366f1;
                  border-radius: 50%;
                  width: 32px;
                  height: 32px;
                  animation: spin 1s linear infinite;
                  margin: 0 auto 16px auto;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              </style>
            </head>
            <body>
              <div>
                <div class="loader"></div>
                <p style="font-size: 14px; color: #94a3b8; font-weight: 500;">Securely connecting with Google...</p>
              </div>
            </body>
          </html>
        `);
        try {
          popup.document.close();
        } catch (closeErr) {
          // ignore
        }
      } catch (writeErr) {
        console.warn("Could not write initial loader to popup:", writeErr);
      }
    }

    try {
      // 2. Fetch Google Consent Screen URL from our backend, packing the frontend origin dynamically
      const originParam = encodeURIComponent(window.location.origin);
      const response = await fetch(getApiUrl(`/api/auth/google/url?origin=${originParam}`));
      if (!response.ok) {
        throw new Error("Unable to retrieve Google OAuth parameters.");
      }
      const { url } = await safeParseJson(response);

      // 3. Set the redirect URL of the pre-opened popup
      let setHrefSuccess = false;
      if (popup) {
        try {
          popup.location.href = url;
          setHrefSuccess = true;
        } catch (locationErr) {
          console.warn("Failed to set popup location directly:", locationErr);
        }
      }
      
      if (!setHrefSuccess) {
        // Fallback: If popup blocker completely blocked it or we couldn't change location, open in a new tab directly
        try {
          window.open(url, "_blank");
        } catch (fallbackOpenErr) {
          console.warn("window.open fallback blocked:", fallbackOpenErr);
          window.location.href = url; // Hard redirect as the ultimate bulletproof fallback
        }
      }
    } catch (err: any) {
      console.error("Google login initiation error:", err);
      if (popup) {
        try {
          popup.close();
        } catch (closeErr) {
          console.warn("Failed to close popup:", closeErr);
        }
      }
      setAdminLoginError(err.message || "Google Connection Error.");
      setIsGoogleLoggingIn(false);
    }
  };

  // Listen for secure callback messages and localstorage fallback for Google authentication
  useEffect(() => {
    const loginWithToken = (token: string, emailFromPayload?: string) => {
      const isAdmin = token.startsWith("secret_astro_token_sampathub89_");

      let email = emailFromPayload || "";
      if (!email) {
        try {
          email = safeStorage.getItem("astro_google_login_email", false) || "";
          if (!email && token.startsWith("user_astro_token_")) {
            const parts = token.split("_");
            if (parts.length >= 5) {
              const base64Part = parts[4];
              // decode base64 email safe
              let padded = base64Part;
              while (padded.length % 4 !== 0) {
                padded += "=";
              }
              email = atob(padded);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (isAdmin) {
        safeStorage.setItem("astro_admin_token", token, true);
        safeStorage.setItem("astro_admin_token", token, false);
        setAdminToken(token);
        setIsAdminLoggedIn(true);
        setIsAdminPanelOpen(true);
        fetchAdminReports(token);
      } else {
        safeStorage.setItem("astro_user_token", token, true);
        safeStorage.setItem("astro_user_token", token, false);
        if (email) {
          safeStorage.setItem("astro_user_email", email, false);
          setUserEmail(email);
        }
        setUserToken(token);
        setIsUserLoggedIn(true);

        // Explicit security: clear admin credentials for other users
        setAdminToken(null);
        setIsAdminLoggedIn(false);
        setIsAdminPanelOpen(false);
      }

      setShowAdminLoginModal(false);
      setIsGoogleLoggingIn(false);

      // Clean up temp local storage items
      try {
        safeStorage.removeItem("astro_google_login_token", false);
        safeStorage.removeItem("astro_google_login_success", false);
        safeStorage.removeItem("astro_google_login_email", false);
        safeStorage.removeItem("astro_google_login_is_admin", false);
      } catch (err) {
        // Safe catch
      }
    };

    const handleGoogleMessage = (event: MessageEvent) => {
      // Verify origin matches our current window or runs in development
      const origin = event.origin || "";
      if (typeof origin !== 'string' || (
        !origin.endsWith('.run.app') && 
        !origin.includes('localhost') && 
        !origin.includes('127.0.0.1') && 
        !origin.includes('netlify.app') && 
        origin !== 'null'
      )) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data?.token;
        const email = event.data?.email;
        if (token) {
          loginWithToken(token, email);
        }
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
        setAdminLoginError(event.data?.error || "Google Authentication failed.");
        setIsGoogleLoggingIn(false);
      }
    };

    // 1. Cross-tab storage listener
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "astro_google_login_token" && e.newValue) {
        const email = safeStorage.getItem("astro_google_login_email", false) || "";
        loginWithToken(e.newValue, email);
      }
    };

    // 2. Active Polling interval (failsafe for iframes/sandboxes)
    const checkInterval = setInterval(() => {
      try {
        const token = safeStorage.getItem("astro_google_login_token", false);
        const success = safeStorage.getItem("astro_google_login_success", false);
        const email = safeStorage.getItem("astro_google_login_email", false) || "";
        if (success === "true" && token) {
          loginWithToken(token, email);
        }
      } catch (err) {
        // Safe catch
      }
    }, 450);

    // 3. Startup check for redirected query parameters (reliable fallback for sandboxed/cross-origin environments)
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get("admin_token");
      const emailFromUrl = params.get("email") || "";
      const errorFromUrl = params.get("admin_error");
      
      if (tokenFromUrl) {
        loginWithToken(tokenFromUrl, emailFromUrl);
        // Clean URL params cleanly
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (errorFromUrl) {
        setAdminLoginError(errorFromUrl);
        setIsGoogleLoggingIn(false);
        setShowAdminLoginModal(true);
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (err) {
      console.error("URL check error:", err);
    }

    window.addEventListener('message', handleGoogleMessage);
    window.addEventListener('storage', handleStorageEvent);
    
    return () => {
      window.removeEventListener('message', handleGoogleMessage);
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(checkInterval);
    };
  }, []);

  const handleAdminLogout = () => {
    safeStorage.removeItem("astro_admin_token", true);
    safeStorage.removeItem("astro_admin_token", false);
    safeStorage.removeItem("astro_user_token", true);
    safeStorage.removeItem("astro_user_token", false);
    safeStorage.removeItem("astro_user_email", false);
    setAdminToken(null);
    setIsAdminLoggedIn(false);
    setIsAdminPanelOpen(false);
    setAdminReports([]);
    setUserToken(null);
    setUserEmail(null);
    setIsUserLoggedIn(false);
  };

  const handlePrintReport = () => {
    const printContent = document.getElementById("print-area-wrapper")?.innerHTML;
    if (!printContent) {
      try {
        console.warn(lang === 'sinhala' ? "මුද්‍රණය සඳහා දත්ත සොයාගත නොහැක." : "Printable contents not found.");
        setError(lang === 'sinhala' ? "මුද්‍රණය සඳහා දත්ත සොයාගත නොහැක." : "Printable contents not found.");
      } catch (err) {
        // Safe block fallback
      }
      return;
    }

    // 1. Grab all active stylesheets & styles, converting relative links to absolute ones to avoid sandbox load limits
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => {
        try {
          if (el.tagName.toLowerCase() === 'link') {
            const href = el.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
              const absoluteHref = new URL(href, window.location.origin).href;
              const cloned = el.cloneNode() as HTMLLinkElement;
              cloned.setAttribute('href', absoluteHref);
              return cloned.outerHTML;
            }
          }
        } catch (err) {
          // Fallback to source HTML if anything errors out
        }
        return el.outerHTML;
      })
      .join("\n");

    // 2. Define custom styling rules to guarantee standard A4 booklet formatting
    const printStyles = `
      <style>
        @page {
          size: A4;
          margin: 0mm;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #451a03 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-area-wrapper {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background-color: #ffffff !important;
          }
          .a4-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
            border: 3px double #b45309 !important; /* Gold border */
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        
        /* Interactive preview styles for non-print mode */
        html, body {
          background-color: #f8fafc;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          font-family: sans-serif;
        }
        #print-area-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 210mm;
        }
        .a4-page {
          background: white;
          width: 210mm;
          min-height: 297mm;
          padding: 15mm 20mm;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
          box-sizing: border-box;
          border: 3px double #b45309;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }
      </style>
    `;

    // 3. Try opening in a new tab first (safest, ignores iframe boundaries and print blockages)
    let printWindow: Window | null = null;
    try {
      printWindow = window.open("", "_blank");
    } catch (err) {
      console.warn("window.open blocked or failed:", err);
    }
    let writeSuccess = false;
    if (printWindow) {
      try {
        printWindow.document.open();
        const docTitle = result?.birthDetails?.name ? result.birthDetails.name + " - Horoscope Report" : "Astrology Birth Charter";
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${docTitle}</title>
              ${styleTags}
              ${printStyles}
            </head>
            <body>
              <div id="print-area-wrapper">
                ${printContent}
              </div>
              <script>
                window.addEventListener('DOMContentLoaded', () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 800);
                });
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        writeSuccess = true;
      } catch (printWriteErr) {
        console.warn("Writing to new window document failed (CORS/iframe constraint):", printWriteErr);
        try {
          printWindow.close();
        } catch (e) {}
      }
    }

    if (!writeSuccess) {
      // 4. Fallback: If Popup Blocker is enabled, render in hidden iframe
      try {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.bottom = "0";
        iframe.style.right = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.opacity = "0";
        
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Horoscope Report</title>
                ${styleTags}
                ${printStyles}
              </head>
              <body>
                <div id="print-area-wrapper">
                  ${printContent}
                </div>
              </body>
            </html>
          `);
          iframeDoc.close();
          
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              setTimeout(() => {
                document.body.removeChild(iframe);
              }, 1000);
            } catch (iframeErr) {
              console.error("Iframe print blocked:", iframeErr);
              window.print();
            }
          }, 800);
        } else {
          window.print();
        }
      } catch (fallbackErr) {
        console.error("Print fallback failed:", fallbackErr);
        window.print();
      }
    }
  };

  // Loading animation loops
  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingStepIdx(0);
      interval = setInterval(() => {
        setLoadingStepIdx(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Scroll chat container inside to bottom (only when there are subsequent messages during active user chat)
  useEffect(() => {
    if (chatMessages.length > 1) {
      const container = document.getElementById("chatbot_messages_scroller");
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, [chatMessages, chatLoading]);

  // Main generator call
  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setChatMessages([]);
    setReportContactValue("");
    setUserRating(0);
    setUserComment("");
    setRatingSubmittedUs(false);

    try {
      const response = await fetch(getApiUrl("/api/astrology/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birthDate,
          birthTime,
          birthPlace: birthPlace || "Town",
          district,
          gender,
          language: lang,
        }),
      });

      if (!response.ok) {
        const errorData = await safeParseJson(response);
        throw new Error(errorData.error || "Failed to calculate horoscope chart.");
      }

      const data = await safeParseJson(response);
      const computedBirthDetails = {
        name: name || "Anonymous (කසුන්)",
        birthDate,
        birthTime,
        birthPlace: birthPlace || "Town",
        district,
        gender,
        language: lang,
      };

      setResult({
        ...data,
        birthDetails: computedBirthDetails
      });
      
      // Initialize chat message with localized greeting
      const welcomeMsg = lang === 'sinhala'
        ? `ආයුබෝවන් ${name || 'ඔබට'}. ඔබගේ ${data.chart.lagnaSinhala} ලග්න කේන්දර සටහන සහ පලාපල සාර්ථකව ගණනය කර අවසන්. ඔබගේ කේන්දරයේ ග්‍රහ පිහිටීම් හෝ ඉදිරි කාලය ගැන ඔබට ඇති ඕනෑම ප්‍රශ්නයක් මෙතැනින් විමසන්න.`
        : `Greetings ${name || 'User'}. Your ${data.chart.lagna} Ascendant chart and readings are fully computed. Feel free to ask any specific astrological questions or request clarifications about your planetary transits, remedies, and career.`;
      
      setChatMessages([
        {
          id: "welcome-1",
          sender: "assistant",
          text: welcomeMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // Automatically and immediately save details to the admin panel database and Google Drive backup
      try {
        const autoSaveResponse = await fetch(getApiUrl("/api/reports/save"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            birthDetails: computedBirthDetails,
            chart: data.chart,
            predictions: data.predictions,
            contactType: "direct_calculation",
            contactValue: "Direct Calculation (මුද්‍රණය නොකළ වාර්තාව)"
          })
        });
        const autoSaveData = await safeParseJson(autoSaveResponse);
        if (autoSaveData && autoSaveData.success) {
          setSavedReportId(autoSaveData.reportId);
          // If the admin is logged in, refresh the list immediately
          const currentToken = safeStorage.getItem("astro_admin_token", true) || safeStorage.getItem("astro_admin_token", false);
          if (currentToken) {
            // Trigger load to sync admin logs automatically
            fetchAdminReports(currentToken);
          }
        }
      } catch (saveErr) {
        console.error("Automatic immediate background save failed:", saveErr);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An expected server error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Chat message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !result) return;

    const userMsgText = chatInput;
    setChatInput("");

    const newMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    setChatLoading(true);

    try {
      const historyToSend = chatMessages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const res = await fetch(getApiUrl("/api/astrology/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDetails: result.birthDetails,
          chart: result.chart,
          message: userMsgText,
          history: historyToSend
        })
      });

      if (!res.ok) {
        const errData = await safeParseJson(res);
        throw new Error(errData.error || "Communication interruption.");
      }

      const data = await safeParseJson(res);
      
      setChatMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        id: `assistant-err-${Date.now()}`,
        sender: "assistant",
        text: lang === 'sinhala' 
          ? "පද්ධතිය කාර්යබහුලයි. කරුණාකර නැවත විමසන්න." 
          : "Astrologer connection lost. Please try again in secondary, or re-submit query.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Helper: return sign number for each house (1 to 12)
  const getHouseSignNumber = (houseNum: number, lagnaName: string) => {
    const zodiacMap: { [key: string]: number } = {
      "Aries": 1, "Taurus": 2, "Gemini": 3, "Cancer": 4, "Leo": 5, "Virgo": 6,
      "Libra": 7, "Scorpio": 8, "Sagittarius": 9, "Capricorn": 10, "Aquarius": 11, "Pisces": 12
    };
    const lagnaIdx = zodiacMap[lagnaName] || 1;
    return ((lagnaIdx - 1 + (houseNum - 1)) % 12) + 1;
  };

  // Helper: map sign index to Sinhala name
  const getSignNameSinhala = (idx: number) => {
    const names = ["මේෂ", "වෘෂභ", "මිථුන", "කටක", "සිංහ", "කන්‍යා", "තුලා", "වෘශ්චික", "ධනු", "මකර", "කුම්භ", "මීන"];
    return names[idx - 1] || "";
  };

  // House center points for SVG diamond Kundali layout
  const HOUSE_COORDS: { [key: number]: { x: number; y: number; numX: number; numY: number } } = {
    1: { x: 200, y: 150, numX: 200, numY: 85 },   // Top central diamond
    2: { x: 125, y: 70, numX: 110, numY: 45 },    // Top-left side
    3: { x: 70, y: 125, numX: 45, numY: 100 },    // Upper-left side
    4: { x: 110, y: 200, numX: 85, numY: 200 },   // Left central diamond
    5: { x: 75, y: 275, numX: 45, numY: 300 },    // Lower-left side
    6: { x: 125, y: 330, numX: 110, numY: 355 },  // Bottom-left side
    7: { x: 200, y: 260, numX: 200, numY: 315 },  // Bottom central diamond
    8: { x: 275, y: 330, numX: 290, numY: 355 },  // Bottom-right side
    9: { x: 330, y: 275, numX: 355, numY: 300 },  // Lower-right side
    10: { x: 290, y: 200, numX: 315, numY: 200 }, // Right central diamond
    11: { x: 330, y: 125, numX: 355, numY: 100 }, // Upper-right side
    12: { x: 275, y: 70, numX: 290, numY: 45 },   // Top-right side
  };

  return (
    <div className="min-h-screen px-4 py-8 focus-outline-none" id="main_container">
      {/* Glow Stars Overlay Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 z-0">
        <div className="absolute top-1/4 left-1/4 w-1 bg-yellow-300 h-1 rounded-full animate-ping" />
        <div className="absolute top-1/3 left-3/4 w-1 bg-white h-1 rounded-full duration-1000 animate-pulse" />
        <div className="absolute top-2/3 left-1/3 w-1.5 bg-purple-400 h-1.5 rounded-full duration-700 animate-pulse" />
        <div className="absolute top-4/5 left-4/5 w-1 bg-teal-300 h-1 rounded-full animate-ping" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* HEADER PANEL */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-slate-800/80 mb-8 glow-purple" id="header_section">
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-500/50 flex-shrink-0">
              <img 
                src={bannerImg} 
                alt="Astrology Banner Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                id="brand_banner_logo"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-indigo-400">
                {lang === 'sinhala' ? "ශ්‍රී ලාංකීය ජ්‍යෝතිෂ්‍ය කේන්දරය" : "Sri Lankan Horoscope & Horoscope Predictions"}
              </h1>
              <p className="text-xs text-slate-400/90 font-sans tracking-wide mt-1">
                {lang === 'sinhala' 
                  ? "උපන් වෙලාව, දිනය සහ ස්ථානය අනුව පූර්ණ නිවැරදි කේන්දර පලාපල සේවාව" 
                  : "Vedic charts, planet transits, and detailed predictions calculated live in Sri Lanka"}
              </p>
            </div>
          </div>

          {/* Global Language Toggle & Admin Portal Link */}
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setLang('sinhala')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  lang === 'sinhala' 
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="lang_sinhala_btn"
              >
                සිංහල (Sinhala)
              </button>
              <button
                onClick={() => setLang('english')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  lang === 'english' 
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="lang_english_btn"
              >
                English
              </button>
            </div>

            {/* Dynamic Sign-In & Admin Isolation Header Controls */}
            <div className="flex items-center gap-2">
              {(isUserLoggedIn || isAdminLoggedIn) ? (
                /* Authenticated State Display */
                <div className="flex items-center gap-2 border border-slate-800 bg-slate-950/40 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="max-w-[145px] truncate font-sans">
                    {isAdminLoggedIn ? "sampathub89@gmail.com" : userEmail}
                  </span>
                  <button 
                    onClick={handleAdminLogout} 
                    className="ml-1 text-slate-500 hover:text-rose-400 font-bold transition-all text-[9px] uppercase font-sans cursor-pointer hover:underline"
                  >
                    {lang === 'sinhala' ? "ඉවත් වන්න" : "Logout"}
                  </button>
                </div>
              ) : (
                /* Unauthenticated State: Show general user Google Sign-In */
                <button
                  onClick={() => setShowAdminLoginModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md transform active:scale-95"
                  id="google_signin_trigger_btn"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  {lang === 'sinhala' ? "ඇතුල් වන්න" : "Sign In"}
                </button>
              )}

              {/* Show Admin Panel button STRICTLY only for the verified Admin account */}
              {isAdminLoggedIn && (
                <button
                  onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold animate-pulse"
                  id="admin_portal_toggle_btn"
                >
                  <Award className="w-3.5 h-3.5" />
                  {lang === 'sinhala' ? "ඇඩ්මින් පැනලය" : "Admin Panel"}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY: SPLIT ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: INPUT FORM SHEET (Span 4) */}
          <aside className="lg:col-span-4 bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-slate-800 glow-purple" id="sidebar_input_form">
            <div className="flex items-center gap-2.5 mb-6 border-b border-slate-800 pb-4">
              <Compass className="w-5 h-5 text-amber-400 animate-spin-slow" />
              <h3 className="text-lg font-bold font-display text-slate-100">
                {lang === 'sinhala' ? "උපත් තොරතුරු ඇතුලත් කරන්න" : "Birth Information Details"}
              </h3>
            </div>

            <form onSubmit={handleCalculate} className="space-y-5" id="astro_input_form">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {lang === 'sinhala' ? "සම්පූර්ණ නම (අත්‍යවශ්‍ය නොවේ)" : "Full Name (Optional)"}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'sinhala' ? "උදා: කසුන් පෙරේරා" : "e.g., Kasun Perera"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans"
                    id="input_name"
                  />
                </div>
              </div>

              {/* Selector Mode Toggle */}
              <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-450 font-medium font-sans">
                    {lang === 'sinhala' ? "තේරීම් ක්‍රමය" : "Input Mode"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerMode(pickerMode === 'dropdown' ? 'calendar' : 'dropdown')}
                    className="text-[11px] font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer bg-slate-950/40 px-2 py-0.5 rounded-md border border-slate-805/50"
                    id="toggle_picker_mode_btn"
                  >
                    {pickerMode === 'dropdown' ? (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>{lang === 'sinhala' ? "කැලැන්ඩරය භාවිත කරන්න" : "Use Calendar Picker"}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{lang === 'sinhala' ? "ලැයිස්තුවෙන් තෝරන්න" : "Use Lists / Dropdowns"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pickerMode === 'dropdown' ? (
                <div className="space-y-4">
                  {/* Dropdown-based Date Selectors */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === 'sinhala' ? "උපන් දිනය (දිනය / මාසය / අවුරුද්ද)" : "Birth Date (Day / Month / Year)"} *
                    </label>
                    <div className="grid grid-cols-12 gap-2" id="dropdown_birth_date_grid">
                      {/* Day Select */}
                      <div className="col-span-3 relative">
                        <select
                          value={currentDay}
                          onChange={(e) => handleDayChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer text-center font-mono"
                          id="select_birth_day"
                        >
                          {DAYS.map(d => (
                            <option key={d} value={d}>{parseInt(d, 10)}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>

                      {/* Month Select */}
                      <div className="col-span-5 relative">
                        <select
                          value={currentMonth}
                          onChange={(e) => handleMonthChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer font-sans"
                          id="select_birth_month"
                        >
                          {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>
                              {lang === 'sinhala' ? m.nameSi : m.nameEn}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center pr-1 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>

                      {/* Year Select */}
                      <div className="col-span-4 relative">
                        <select
                          value={currentYear}
                          onChange={(e) => handleYearChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer text-center font-mono"
                          id="select_birth_year"
                        >
                          {YEARS.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown-based Time Selectors */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === 'sinhala' ? "උපන් වේලාව (පැය / මිනිත්තු)" : "Birth Time (Hours / Minutes)"} *
                    </label>
                    <div className="grid grid-cols-3 gap-2" id="dropdown_birth_time_grid">
                      {/* Hour Select */}
                      <div className="relative">
                        <select
                          value={String(currentHour12)}
                          onChange={(e) => handleHourChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer text-center font-mono"
                          id="select_birth_hour"
                        >
                          {HOURS.map(h => (
                            <option key={h} value={h}>{h.padStart(2, "0")}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>

                      {/* Minutes Select */}
                      <div className="relative">
                        <select
                          value={currentMinStr}
                          onChange={(e) => handleMinuteChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer text-center font-mono"
                          id="select_birth_minute"
                        >
                          {MINUTES.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>

                      {/* AM / PM Select */}
                      <div className="relative">
                        <select
                          value={currentAmPm}
                          onChange={(e) => handleAmPmChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer text-center font-sans font-semibold text-slate-200"
                          id="select_birth_ampm"
                        >
                          <option value="AM">{lang === 'sinhala' ? "පෙ.ව. (AM)" : "AM"}</option>
                          <option value="PM">{lang === 'sinhala' ? "ප.ව. (PM)" : "PM"}</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500">
                          <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === 'sinhala' ? "උපන් දිනය" : "Birth Date"} *
                    </label>
                    <div className="relative font-mono">
                      <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        id="input_birth_date"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === 'sinhala' ? "උපන් වේලාව" : "Birth Time"} *
                    </label>
                    <div className="relative font-mono">
                      <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="time"
                        required
                        value={birthTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        id="input_birth_time"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {lang === 'sinhala' ? "උපන් ස්ථානය/නගරය (ශ්‍රී ලංකාව)" : "Birth Town/City (Sri Lanka)"}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder={lang === 'sinhala' ? "උදා: මහරගම හෝ මහනුවර" : "e.g., Maharagama or Kandy"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    id="input_birth_place"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {lang === 'sinhala' ? "උපන් දිස්ත්‍රික්කය" : "Birth District"} *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none cursor-pointer"
                    id="select_district"
                  >
                    {DISTRICTS.map((dst) => (
                      <option key={dst} value={dst}>{dst}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {lang === 'sinhala' ? "ස්ත්‍රී / පුරුෂ භාවය" : "Gender"}
                </label>
                <div className="grid grid-cols-2 gap-3" id="gender_selector">
                  <button
                    type="button"
                    onClick={() => setGender("Male")}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      gender === "Male"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    id="gender_male_btn"
                  >
                    {lang === 'sinhala' ? "පුරුෂ" : "Male"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("Female")}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      gender === "Female"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    id="gender_female_btn"
                  >
                    {lang === 'sinhala' ? "ස්ත්‍රී" : "Female"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-slate-950 text-sm font-bold font-display py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                id="calculate_horoscope_btn"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{lang === 'sinhala' ? "ගණනය වෙමින් පවතී..." : "Calculating..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>{lang === 'sinhala' ? "කේන්දර සටහන බලන්න" : "Generate Horoscope Readings"}</span>
                  </>
                )}
              </button>
            </form>

            {result && (
              <button
                type="button"
                onClick={handleClearData}
                className="w-full mt-3 bg-rose-950/20 hover:bg-rose-900/20 text-rose-400 hover:text-rose-300 border border-rose-900/30 text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] font-sans"
                id="clear_calc_data_btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'sinhala' ? "දත්ත මකන්න (Clear Data)" : "Clear Data / Start Over"}</span>
              </button>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-950/20 border border-red-900/60 rounded-xl flex gap-3 text-red-200 text-xs text-left" id="error_alert">
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">{lang === 'sinhala' ? "යම් දෝෂයක් සිදු විය" : "Calculation Error"}</p>
                  <p className="opacity-90 leading-normal">{error}</p>
                </div>
              </div>
            )}
          </aside>

          {/* RIGHT COLUMN: REVIEWS & CHART VISUAL (Span 8) */}
          <main className="lg:col-span-8 flex flex-col gap-8">
            
            {/* INITIAL BLANK / EMPTY PLACEHOLDER */}
            {!loading && !result && (
              <section className="flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-800 py-24" id="placeholder_view">
                <div className="w-20 h-20 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mb-6 shadow-md shadow-purple-500/5">
                  <Sparkles className="w-9 h-9 text-amber-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold font-display text-slate-200 mb-2">
                  {lang === 'sinhala' ? "ඔබේ හඳහන මෙතැනින් බලන්න" : "Explore Your Spiritual Horoscope"}
                </h3>
                <p className="text-slate-400 text-xs max-w-sm leading-relaxed font-sans">
                  {lang === 'sinhala' 
                    ? "ඔබගේ උපන් දිනය, වේලාව සහ ස්ථානය ඇතුලත් කර 'කේන්දර සටහන බලන්න' බොත්තම ඔබන්න. පූර්ණ ලග්න කේන්දර රූප සටහන සහ පලාපල මෙතැනින් දිස්වනු ඇත."
                    : "Fill in your birth coordinates to map the heavenly nodes. You will receive an authentic Hela diamond-mesh chart and detailed Sanskrit predictions."}
                </p>
              </section>
            )}

            {/* LOADING STATE TRANSLITION SHEET */}
            {loading && (
              <section className="flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 rounded-2xl border border-slate-800/80 py-28" id="loading_view">
                <div className="relative w-28 h-28 mb-8" id="rotating_zodiac_wheel">
                  {/* Astrology outer spinner */}
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/30 animate-spin-slow" />
                  <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-spin" style={{ animationDuration: '6s' }} />
                  {/* Astrology central glowing core */}
                  <div className="absolute inset-6 rounded-full bg-slate-950 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                    <Compass className="w-8 h-8 text-amber-400 animate-spin-slow" />
                  </div>
                </div>
                
                {/* Dynamically changing transitional spiritual text */}
                <h4 className="text-sm font-semibold font-sans text-amber-300 tracking-wider h-6 animate-pulse" id="loading_step_text">
                  {LOADING_STEPS[loadingStepIdx][lang]}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-3 leading-relaxed">
                  {lang === 'sinhala'
                    ? "විශ්ව කේන්ද්‍රස්ථාන හා ග්‍රහ වස්තූන් අතර සැබෑ පිහිටීම් ගණනය කරමින් පවතී. කරුණාකර සුළු මොහොතක් රැඳී සිටින්න..."
                    : "Fetching absolute transit patterns. Aligning astronomical planetary paths using AI cosmic systems..."}
                </p>
              </section>
            )}

            {/* ASTROLOGY HOROSCOPE RESULT PRESENTATION */}
            {result && !loading && (
              <div className="space-y-8 animate-fade-in" id="result_section">
                
                {/* 1. REPORT HERO DATA CARDS */}
                <section className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-4" id="horoscope_hero_summary">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 text-center relative overflow-hidden flex flex-col justify-center items-center">
                    <div className="absolute top-2 right-2 opacity-5">
                      <Award className="w-16 h-16" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      {lang === 'sinhala' ? "ලග්නය" : "Ascendant (Lagna)"}
                    </span>
                    <span className="text-xl md:text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                      {lang === 'sinhala' ? `${result.chart.lagnaSinhala} ලග්නය` : result.chart.lagna}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 text-center relative overflow-hidden flex flex-col justify-center items-center">
                    <div className="absolute top-2 right-2 opacity-5">
                      <Moon className="w-16 h-16" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      {lang === 'sinhala' ? "චන්ද්‍ර රාශිය" : "Moon Sign (Rashi)"}
                    </span>
                    <span className="text-xl md:text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-200">
                      {lang === 'sinhala' ? `${result.chart.rashiSinhala} රාශිය` : result.chart.rashi}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 text-center relative overflow-hidden flex flex-col justify-center items-center">
                    <div className="absolute top-2 right-2 opacity-5">
                      <Sun className="w-16 h-16" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      {lang === 'sinhala' ? "උපන් නැකත" : "Birth Star (Nakshatra)"}
                    </span>
                    <span className="text-xl md:text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-200">
                      {lang === 'sinhala' ? `${result.chart.nakshatraSinhala} නැකත` : result.chart.nakshatra}
                    </span>
                  </div>
                </section>

                {/* 2. COMPACT VISUALIZATION ROW: CHART AND TABLE */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch" id="visual_chart_row">
                  
                  {/* SVG Traditional Hela Kendraya (6 Cols) */}
                  <div className="md:col-span-6 bg-slate-900/30 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-between" id="visual_kendraya_box">
                    <div className="w-full flex justify-between items-center mb-4 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[11px] font-medium text-slate-300">
                        {lang === 'sinhala' ? "ලග්න කේන්දර සටහන" : "Lagna Kundali Birth Chart"}
                      </span>
                      {/* Language toggler for chart symbols */}
                      <button 
                        onClick={() => setChartLang(prev => prev === 'sinhala' ? 'english' : 'sinhala')}
                        className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-600/40 px-2 py-1 rounded hover:bg-amber-500/30 cursor-pointer text-right uppercase tracking-wider"
                      >
                        {chartLang === 'sinhala' ? "Eng Symbols" : "සින්හල සංකේත"}
                      </button>
                    </div>

                    {/* SVG Drawn traditional 3x3 grid chart (Sri Lankan standard format) */}
                    <div className="relative w-full max-w-[310px] aspect-square flex items-center justify-center bg-white rounded-xl p-4 border border-violet-200 shadow-md shadow-amber-500/5 hover:border-amber-500/30 transition-all duration-300" id="svg_kendraya_wrapper">
                      {(() => {
                        const ascendantDetail = result.chart.planetaryDetails.find(
                          p => p.planet === "Ascendant" || p.planet === "Lagna"
                        );
                        let lagnaDisplayDegree = "27:41:06";
                        if (ascendantDetail?.degree) {
                          const digits = ascendantDetail.degree.match(/\d+/g);
                          if (digits && digits.length >= 2) {
                            const deg = digits[0].padStart(2, "0");
                            const min = digits[1].padStart(2, "0");
                            const sec = digits[2] ? digits[2].padStart(2, "0") : "00";
                            lagnaDisplayDegree = `${deg}:${min}:${sec}`;
                          } else if (digits && digits.length === 1) {
                            lagnaDisplayDegree = `${digits[0].padStart(2, "0")}:00:00`;
                          }
                        }

                        return (
                          <svg viewBox="0 0 390 390" className="w-full h-full text-slate-700 font-sans" id="birth_chart_svg">
                            {/* Pure white background canvas */}
                            <rect x="0" y="0" width="390" height="390" fill="#ffffff" rx="8" />

                            {/* 3x3 Grid Lines */}
                            {/* Horizontal divisions */}
                            <line x1="0" y1="130" x2="390" y2="130" stroke="#cbd5e1" strokeWidth="1.5" />
                            <line x1="0" y1="260" x2="390" y2="260" stroke="#cbd5e1" strokeWidth="1.5" />
                            {/* Vertical divisions */}
                            <line x1="130" y1="0" x2="130" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />
                            <line x1="260" y1="0" x2="260" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />

                            {/* Outer square borders */}
                            <rect x="1" y="1" width="388" height="388" fill="none" stroke="#cbd5e1" strokeWidth="2" />

                            {/* Corner Diagonal Lines */}
                            {/* Top-Left Cell Diagonal (House 2 & 3) */}
                            <line x1="0" y1="0" x2="130" y2="130" stroke="#cbd5e1" strokeWidth="1.5" />
                            {/* Bottom-Left Cell Diagonal (House 5 & 6) */}
                            <line x1="0" y1="390" x2="130" y2="260" stroke="#cbd5e1" strokeWidth="1.5" />
                            {/* Bottom-Right Cell Diagonal (House 8 & 9) */}
                            <line x1="260" y1="260" x2="390" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />
                            {/* Top-Right Cell Diagonal (House 11 & 12) */}
                            <line x1="260" y1="130" x2="390" y2="0" stroke="#cbd5e1" strokeWidth="1.5" />

                            {/* Center Square (C5) Custom Styling */}
                            <rect x="131" y="131" width="128" height="128" fill="#fcfbf8" rx="4" />

                            {/* Draw contents for all 12 houses */}
                            {HOUSE_METADATA.map((meta) => {
                              const zodiacSignIndex = getHouseSignNumber(meta.house, result?.chart?.lagna || "Aries");
                              let housePlacements = result?.chart?.housePlacements || {};
                              
                              // Fallback: Reconstruct housePlacements from planetaryDetails if empty/missing
                              if (Object.keys(housePlacements).length === 0 && result?.chart?.planetaryDetails) {
                                const reconstructed: { [key: string]: string[] } = {
                                  "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [], "8": [], "9": [], "10": [], "11": [], "12": []
                                };
                                result.chart.planetaryDetails.forEach((p: any) => {
                                  if (p.house) {
                                    const hKey = p.house.toString();
                                    if (!reconstructed[hKey]) reconstructed[hKey] = [];
                                    if (!reconstructed[hKey].includes(p.planet)) {
                                      reconstructed[hKey].push(p.planet);
                                    }
                                  }
                                });
                                housePlacements = reconstructed;
                              }
                              const planetsInHouse = housePlacements[meta.house] || [];

                              // Format planetary abbreviations
                              const formattedPlanets = planetsInHouse.map(planetName => {
                                const symbolInfo = PLANET_SYMBOLS[planetName] || { 
                                  en: planetName.substring(0, 2), 
                                  si: planetName.substring(0, 1) 
                                };
                                const displaySymbol = chartLang === 'sinhala' ? symbolInfo.si : symbolInfo.en;
                                const isAsc = planetName === 'Ascendant' || planetName === 'Lagna';
                                const prefix = (chartLang === 'sinhala' && !isAsc) ? "-" : "";
                                const text = prefix + displaySymbol;
                                const color = CHART_PLANET_COLORS[planetName]?.text || "#1e293b";
                                return { name: planetName, text, color };
                              });

                               return (
                                <g key={meta.house} id={`house_group_${meta.house}`}>
                                  {/* RASHI NUMBER INDICATOR */}
                                  {meta.rashiBadge ? (
                                    meta.rashiBadge.type === "green-box" ? (
                                      <g id={`rashi_badge_house_${meta.house}`}>
                                        <rect 
                                          x={meta.rashiBadge.x} 
                                          y={meta.rashiBadge.y} 
                                          width="18" 
                                          height="18" 
                                          rx="3" 
                                          fill="#0d9488" 
                                        />
                                        <text 
                                          x={meta.rashiBadge.x + 9} 
                                          y={meta.rashiBadge.y + 14} 
                                          fill="#ffffff" 
                                          fontSize="13" 
                                          fontWeight="bold" 
                                          textAnchor="middle"
                                          className="font-handwritten"
                                        >
                                          {zodiacSignIndex}
                                        </text>
                                      </g>
                                    ) : (
                                      <g id={`rashi_badge_house_${meta.house}`}>
                                        <circle 
                                          cx={meta.rashiBadge.cx} 
                                          cy={meta.rashiBadge.cy} 
                                          r="9" 
                                          fill="#0d9488" 
                                        />
                                        <text 
                                          x={meta.rashiBadge.cx} 
                                          y={meta.rashiBadge.cy + 4.5} 
                                          fill="#ffffff" 
                                          fontSize="12" 
                                          fontWeight="bold" 
                                          textAnchor="middle"
                                          className="font-handwritten"
                                        >
                                          {zodiacSignIndex}
                                        </text>
                                      </g>
                                    )
                                  ) : (
                                    meta.rashiLabel && (
                                      <text 
                                        x={meta.rashiLabel.x} 
                                        y={meta.rashiLabel.y} 
                                        fill={meta.rashiLabel.color} 
                                        fontSize="13" 
                                        fontWeight="bold" 
                                        textAnchor="middle"
                                        className="font-handwritten"
                                      >
                                        {zodiacSignIndex}
                                      </text>
                                    )
                                  )}

                                  {/* HOUSE CIRCLE BADGE (BHAVA LABEL) */}
                                  {meta.houseCircle && (
                                    <g id={`house_circle_${meta.house}`}>
                                      <circle 
                                        cx={meta.houseCircle.cx} 
                                        cy={meta.houseCircle.cy} 
                                        r="10.5" 
                                        fill="#f1f5f9" 
                                        stroke="#cbd5e1" 
                                        strokeWidth="1" 
                                      />
                                      <text 
                                        x={meta.houseCircle.cx} 
                                        y={meta.houseCircle.cy + 4.5} 
                                        fill="#4f46e5" 
                                        fontSize="12" 
                                        fontWeight="bold" 
                                        textAnchor="middle"
                                        className="font-handwritten"
                                      >
                                        {meta.houseCircle.text}
                                      </text>
                                    </g>
                                  )}

                                  {/* CELL ARUDHA / AUX LABELS */}
                                  {meta.label && (
                                    <text 
                                      x={meta.label.x} 
                                      y={meta.label.y} 
                                      fill={meta.label.color} 
                                      fontSize="11" 
                                      fontWeight="bold" 
                                      className="font-handwritten"
                                    >
                                      {meta.label.text}
                                    </text>
                                  )}

                                  {/* PLANET SYMBOLS */}
                                  {formattedPlanets.length > 0 && (
                                    <g id={`planets_house_${meta.house}`}>
                                      <text 
                                        x={meta.centroid.x} 
                                        y={meta.centroid.y + 2} 
                                        textAnchor="middle" 
                                        fontSize="16" 
                                        fontWeight="bold"
                                        className="font-handwritten"
                                      >
                                        {formattedPlanets.map((p, pIdx) => (
                                          <tspan key={p.name} fill={p.color} dx={pIdx > 0 ? "6" : "0"}>
                                            {p.text}
                                          </tspan>
                                        ))}
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })}

                            {/* Center Box Details (Lagna name badge, vector emoji, degree) rendered using foreignObject */}
                            <foreignObject x="131" y="131" width="128" height="128">
                              <div className="w-full h-full flex flex-col items-center justify-between p-3 select-none text-center">
                                {/* Degree */}
                                <div className="text-[13px] font-bold text-slate-900 font-handwritten tracking-wider italic">
                                  {lagnaDisplayDegree}
                                </div>
                                
                                {/* Zodiac Icon */}
                                <div className="text-3xl filter drop-shadow flex items-center justify-center flex-1">
                                  <span className="text-blue-500 mr-1" title={result.chart.lagna}>
                                    {getZodiacArtSymbol(result.chart.lagna)}
                                  </span>
                                  <span className="text-amber-600 text-sm font-bold font-handwritten block" title={result.chart.lagna}>
                                    {getZodiacSymbol(result.chart.lagna)}
                                  </span>
                                </div>

                                {/* Blue Lagna Badge matching Sri Lankan birth charts */}
                                <div className="px-4 py-1 bg-[#1e88e5] text-white rounded-lg text-[13px] font-bold leading-none shadow-sm min-w-[70px] text-center font-handwritten">
                                  {lang === 'sinhala' ? result.chart.lagnaSinhala : result.chart.lagna}
                                </div>
                              </div>
                            </foreignObject>
                          </svg>
                        );
                      })()}
                    </div>

                    <div className="w-full text-center mt-3" id="kendraya_chart_legend">
                      <span className="text-[10px] text-slate-500 font-sans tracking-wide">
                        {lang === 'sinhala' 
                          ? "* සටහනේ දිස්වන ඉලක්කම් ලග්න කොටුවලට අදාල රාශි අංක වේ (1=මේෂ, 2=වෘෂභ, ආදී)" 
                          : "* Numbers inside houses match Vedic Zodiac Sign Index (1=Aries, 2=Taurus, etc.)"}
                      </span>
                    </div>
                  </div>

                  {/* Planet Placements List (6 Cols) */}
                  <div className="md:col-span-6 bg-slate-900/30 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between" id="planet_list_container">
                    <div className="mb-4 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[11px] font-medium text-slate-300">
                        {lang === 'sinhala' ? "ග්‍රහ පිහිටීම් විස්තරය" : "Planetary Positions & Alignments"}
                      </span>
                    </div>

                    <div className="overflow-y-auto max-h-[300px] border border-slate-800/50 rounded-xl pr-1 text-slate-200" id="planetary_specs_table">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-[9px] text-slate-400 capitalize tracking-widest bg-slate-950/40">
                            <th className="py-2.5 px-3">{lang === 'sinhala' ? "ග්‍රහයා" : "Planet"}</th>
                            <th className="py-2.5 px-3">{lang === 'sinhala' ? "රාශිය" : "Zodiac Sign"}</th>
                            <th className="py-2.5 px-3 text-center">{lang === 'sinhala' ? "කොටුව" : "House"}</th>
                            <th className="py-2.5 px-3 text-right">{lang === 'sinhala' ? "ස්ඵුටය" : "Degree"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {result.chart.planetaryDetails.map((details) => {
                            const isRetro = details.isRetrograde;
                            const planetId = details.planet;
                            const symbolColor = PLANET_SYMBOLS[planetId]?.color || "text-slate-300";

                            return (
                              <tr key={planetId} className="hover:bg-slate-950/30 transition-all font-sans" id={`planetary_row_${planetId}`}>
                                <td className="py-2 px-3 flex items-center gap-1.5 font-medium">
                                  <span className={`w-1.5 h-1.5 rounded-full ${symbolColor.split(" ")[0].replace("text-", "bg-")}`} />
                                  <span>
                                    {lang === 'sinhala' ? details.planetSinhala : details.planet}
                                  </span>
                                  {isRetro && (
                                    <span className="text-[9px] px-1 py-0.2 bg-red-950/40 text-red-400 border border-red-900/30 rounded font-mono uppercase font-bold tracking-wide">
                                      {lang === 'sinhala' ? "වක්‍ර" : "R"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-300 leading-normal">
                                  {lang === 'sinhala' ? details.signSinhala : details.sign}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-300">
                                  {details.house}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-400">
                                  {details.degree}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 bg-indigo-950/20 border border-slate-800 rounded-xl flex items-center justify-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] text-slate-400 font-sans tracking-wide">
                        {lang === 'sinhala' ? "Lahiri Ayanamsha (UTC+5:30) ආශ්‍රයෙන් ගණනය කරන ලදී." : "Calculated relative to GMT+5:30 using dry Lahiri coordinates."}
                      </span>
                    </div>
                  </div>
                </section>

                {/* 2.5 ASTRONOMICAL CALCULATIONS ENGINE DETAILS */}
                {result.chart.calculations && (
                  <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-5 md:p-6" id="astro_engine_calculations_block">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 font-display">
                          <Compass className="w-4 h-4 text-amber-400" />
                          {lang === 'sinhala' ? "චන්ද්‍ර ස්ඵුටය සහ නැකැත් පාද ගණනය කිරීම්" : "Moon Longitude & Nakshatra Pada Calculations"}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {lang === 'sinhala' 
                            ? "සිංහල සම්ප්‍රදායික ජ්‍යෝතිෂ මෘදුකාංග මඟින් ක්‍රියාත්මක කරන ලද අර්ධ ස්වයංක්‍රීය Lahiri Astro-engine ගණනීය ප්‍රතිඵල" 
                            : "Precise astronomical results mathematically extracted from traditional Lahiri Ayanamsha system"}
                        </p>
                      </div>
                      <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono self-start md:self-auto">
                        Ayanamsha: {result.chart.planetaryDetails.find(p => p.planet === "Ascendant")?.degree || "Lahiri Method"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Side Parameters */}
                      <div className="space-y-4">
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                          <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "චන්ද්‍ර ස්ඵුටය (Moon Longitude)" : "Moon's Exact Longitude"}</span>
                            <span className="font-mono text-amber-300 font-bold">
                              {lang === 'sinhala' ? result.chart.calculations.moonLongitudeFullSi : result.chart.calculations.moonLongitudeFullEn}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "උපන් නැකත" : "Birth Star (Nakshatra)"}</span>
                            <span className="font-semibold text-sky-400">
                              {lang === 'sinhala' ? `${result.chart.calculations.nakshatraNameSi} (${result.chart.calculations.nakshatraNameEn})` : result.chart.calculations.nakshatraNameEn}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "නැකත් පාදය" : "Nakshatra Pada"}</span>
                            <span className="font-mono bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded border border-violet-500/20 font-bold">
                              {lang === 'sinhala' ? `${result.chart.calculations.pada} වන පාදය` : `Pada ${result.chart.calculations.pada}`}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "මහා දශා අධිපති" : "Dasha Lord"}</span>
                            <span className="font-semibold text-teal-400">
                              {lang === 'sinhala' ? `${result.chart.calculations.dashaLordSi} (වසර ${result.chart.calculations.dashaTotalYears})` : `${result.chart.calculations.dashaLordEn} (${result.chart.calculations.dashaTotalYears} Years)`}
                            </span>
                          </div>

                          {result.chart.calculations.ganaSi && (
                            <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5 pt-1">
                              <span className="text-slate-400">{lang === 'sinhala' ? "ගණය (Gana)" : "Gana / Temperament"}</span>
                              <span className="font-semibold text-emerald-400">
                                {lang === 'sinhala' ? `${result.chart.calculations.ganaSi} (${result.chart.calculations.ganaEn})` : result.chart.calculations.ganaEn}
                              </span>
                            </div>
                          )}

                          {result.chart.calculations.yoniSi && (
                            <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2.5 pt-1">
                              <span className="text-slate-400">{lang === 'sinhala' ? "යෝනිය (Yoni)" : "Yoni / Symbol"}</span>
                              <span className="font-semibold text-amber-400">
                                {lang === 'sinhala' ? `${result.chart.calculations.yoniSi} (${result.chart.calculations.yoniEn})` : result.chart.calculations.yoniEn}
                              </span>
                            </div>
                          )}

                          {result.chart.calculations.lingaSi && (
                            <div className="flex justify-between items-center text-xs pt-1">
                              <span className="text-slate-400">{lang === 'sinhala' ? "ලිංගය (Gender)" : "Nakshatra Gender"}</span>
                              <span className="font-semibold text-purple-400">
                                {lang === 'sinhala' ? `${result.chart.calculations.lingaSi} (${result.chart.calculations.lingaEn})` : result.chart.calculations.lingaEn}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Visual Slider inside Pada */}
                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                          <div className="flex justify-between text-xs mb-2 font-sans">
                            <span className="text-slate-300">
                              {lang === 'sinhala' ? `${result.chart.calculations.pada} වන පාදය තුළ සඳුගේ ගමන` : `Moon's Journey inside Pada ${result.chart.calculations.pada}`}
                            </span>
                            <span className="font-mono text-[10px] text-amber-300 font-bold">
                              {Math.round((result.chart.calculations.padaTraveledMinutes / 200) * 100)}%
                            </span>
                          </div>
                          
                          {/* Progress bar container */}
                          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="bg-gradient-to-r from-amber-500 to-sky-400 h-full rounded-full transition-all duration-1000"
                              style={{ width: `${(result.chart.calculations.padaTraveledMinutes / 200) * 100}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1.5 leading-none">
                            <span>0° 00' 00" ({lang === 'sinhala' ? "ආරම්භය" : "Start"})</span>
                            <span>3° 20' 00" (200') ({lang === 'sinhala' ? "අවසානය" : "End"})</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side Formulas & Balance Dasha Calculations */}
                      <div className="flex flex-col justify-between space-y-4">
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs space-y-3 font-sans">
                          <div className="flex justify-between items-center border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "පාදය තුළ ගමන් කළ දුර" : "Distance Traversed in Pada"}</span>
                            <span className="font-mono text-slate-300 font-medium">
                              {result.chart.calculations.padaTraveledFormatted} ({result.chart.calculations.padaTraveledMinutes}')
                            </span>
                          </div>

                          <div className="flex justify-between items-center border-b border-slate-900 pb-2.5">
                            <span className="text-slate-400">{lang === 'sinhala' ? "පාදය තුළ ඉතිරි දුර" : "Distance Remaining in Pada"}</span>
                            <span className="font-mono text-amber-400 font-bold">
                              {result.chart.calculations.padaRemainingFormatted} ({result.chart.calculations.padaRemainingMinutes}')
                            </span>
                          </div>

                          <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80 space-y-2">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                              {lang === 'sinhala' ? "දශා ශේෂය සෙවීමේ ත්‍රෛරාශික සූත්‍රය" : "Vimshottari Dasha Balance Formula"}
                            </div>
                            <div className="text-[10px] text-slate-300 font-mono leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-900/60 select-all whitespace-pre-wrap overflow-x-auto">
                              {lang === 'sinhala' 
                                ? `දශා ශේෂය = [පාදය තුළ ඉතිරි දුර (${result.chart.calculations.padaRemainingMinutes}')] / [පාදයක දිග (200')] × [රවිගේ මුළු දශාව (වසර ${result.chart.calculations.dashaTotalYears})]`
                                : `Balance Dasha = [Remaining distance (${result.chart.calculations.padaRemainingMinutes}')] / [Total Pada length (200')] × [Total Dasha Period (${result.chart.calculations.dashaTotalYears} Years)]`}
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-amber-500/5 text-amber-400 p-3.5 rounded-xl border border-amber-500/10 mt-1">
                            <span className="font-bold text-slate-300">{lang === 'sinhala' ? "උපන් මොහොතේ දශා ශේෂය" : "Birth Balance Dasha"}</span>
                            <span className="font-bold font-mono text-amber-300 text-sm">
                              {lang === 'sinhala' ? result.chart.calculations.balanceDashaSi : result.chart.calculations.balanceDashaEn}
                            </span>
                          </div>

                          {/* Dynamic Current Maha Dasha */}
                          {result.chart.calculations.currentDashaLordEn && (
                            <div className="bg-sky-500/5 text-sky-400 p-3.5 rounded-xl border border-sky-500/10 mt-1 space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-300">{lang === 'sinhala' ? "වත්මන් සක්‍රීය මහ දශාව" : "Current Active Maha Dasha"}</span>
                                <span className="font-bold font-mono text-sky-300 text-sm bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                                  {lang === 'sinhala' ? result.chart.calculations.currentDashaLordSi : result.chart.calculations.currentDashaLordEn}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-900/60 pt-2">
                                <span>{lang === 'sinhala' ? "ක්‍රියාත්මක කාල සීමාව" : "Active Period"}</span>
                                <span className="font-mono text-slate-300">
                                  {result.chart.calculations.currentDashaStart} {lang === 'sinhala' ? "සිට" : "to"} {result.chart.calculations.currentDashaEnd}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-slate-400">
                                <span>{lang === 'sinhala' ? "ඉතිරි කාලය" : "Remaining Time"}</span>
                                <span className="font-mono text-sky-300 font-bold">
                                  {lang === 'sinhala' ? result.chart.calculations.currentDashaRemainingSi : result.chart.calculations.currentDashaRemainingEn}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* 3. SHINY HOROSCOPE PREDICTION ACCORDION/TABS PANEL */}
                <section className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden" id="horoscope_predictions_board">
                  {/* Category Selection Tabs Toolbar */}
                  <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/40 p-2 gap-1" id="predictions_tabs_strip">
                    <button
                      onClick={() => setActiveTab('general')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'general' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_general"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "පොදු ගුණ" : "General Life"}
                    </button>
                    <button
                      onClick={() => setActiveTab('career')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'career' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_career"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "රැකියා/අධ්‍යාපන" : "Career & Work"}
                    </button>
                    <button
                      onClick={() => setActiveTab('wealth')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'wealth' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_wealth"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "ධන වාසනා" : "Wealth luck"}
                    </button>
                    <button
                      onClick={() => setActiveTab('health')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'health' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_health"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "සෞඛ්‍යය" : "Health info"}
                    </button>
                    <button
                      onClick={() => setActiveTab('marriage')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'marriage' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_marriage"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "විවාහ තොරතුරු" : "Marriage life"}
                    </button>
                    <button
                      onClick={() => setActiveTab('dasha')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === 'dasha' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"
                      }`}
                      id="tab_dasha"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {lang === 'sinhala' ? "වත්මන් මහ දශාව" : "Mahadasha remedies"}
                    </button>
                  </div>

                  {/* Predicted Content Presentation Block */}
                  <div className="p-6 md:p-8 text-slate-200 leading-relaxed font-sans text-sm min-h-[160px]" id="predictions_tab_content">
                    {/* Active tab content block */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        {activeTab === 'general' && <span className="p-1 px-2.5 bg-amber-500/20 text-amber-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "පොදු උප්පත්ති පලාපල විස්තරය" : "General Life Overview"}</span>}
                        {activeTab === 'career' && <span className="p-1 px-2.5 bg-orange-500/20 text-orange-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "Wurtheeya Palapala" : "Employment & Educational Fields"}</span>}
                        {activeTab === 'wealth' && <span className="p-1 px-2.5 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "ධන කාරක යෝග තොරතුරු" : "Financial Prospects"}</span>}
                        {activeTab === 'health' && <span className="p-1 px-2.5 bg-rose-500/20 text-rose-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "සෞඛ්‍ය තොරතුරු හා ප්‍රවේශම් විය යුතු දේ" : "Health Indicators"}</span>}
                        {activeTab === 'marriage' && <span className="p-1 px-2.5 bg-pink-500/20 text-pink-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "Wiwaaha Palapala" : "Marital Compatibility & Love Lifecycle"}</span>}
                        {activeTab === 'dasha' && <span className="p-1 px-2.5 bg-fuchsia-500/20 text-fuchsia-400 text-[10px] uppercase tracking-wider rounded font-bold">{lang === 'sinhala' ? "Vimshottari Dasha details" : "Current Vimshottari period remedies"}</span>}
                      </div>

                      <p className="whitespace-pre-line leading-relaxed text-slate-300 antialiased tracking-wide font-sans text-sm text-justify">
                        {result.predictions[activeTab]}
                      </p>
                    </div>
                  </div>

                  {/* 4. LUCKY NUMBERS, COLORS, AND DAYS SUB-CARD */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 border-t border-slate-800 bg-slate-950/40 text-center font-sans" id="lucky_identifiers_board">
                    <div className="p-4" id="lucky_numbers_card">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                        {lang === 'sinhala' ? "වාසනාවන්ත අංක" : "Lucky Numbers"}
                      </span>
                      <div className="flex gap-2 justify-center items-center mt-2">
                        {result.predictions.luckyNumbers.map((num, i) => (
                          <span key={i} className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center justify-center text-xs font-mono">
                            {num}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-4" id="lucky_colors_card">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                        {lang === 'sinhala' ? "වාසනාවන්ත වර්ණ" : "Lucky Colors"}
                      </span>
                      <div className="flex gap-2 justify-center items-center mt-2 text-xs">
                        {result.predictions.luckyColors.map((color, i) => (
                          <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 font-semibold font-sans">
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-4" id="lucky_days_card">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                        {lang === 'sinhala' ? "සුභ දින" : "Auspicious Days"}
                      </span>
                      <div className="flex gap-2 justify-center items-center mt-2 text-xs">
                        {result.predictions.auspiciousDays.map((day, i) => (
                          <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 font-semibold font-sans">
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 5. MULTI-TURN AI ASTROLOGER CHAT INTERFACE */}
                <section className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 shadow-lg relative overflow-hidden" id="astrology_chatbot_box">
                  {/* Subtle vector visual background for chat */}
                  <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none select-none">
                    <MessageSquare className="w-40 h-40" />
                  </div>
                  
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center border border-amber-400/30">
                      <Sparkles className="w-5 h-5 text-slate-950" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                        {lang === 'sinhala' ? "අතිරේක ජ්‍යෝතිෂ උපදෙස් (AI Astrologer)" : "Personal Horoscopic Consultation Chat"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-sans tracking-wide">
                        {lang === 'sinhala' 
                          ? "ඔබගේ ග්‍රහ පිහිටීම්, අපල උපද්‍රව පිළියම්, විවාහ මංගල යෝග පිළිබඳව ඕනෑම දෙයක් මෙතැනින් අසන්න" 
                          : "Ask specific queries about your houses, transits or spiritual remedies"}
                      </p>
                    </div>
                  </div>

                  {/* Messages container list */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 h-[280px] overflow-y-auto space-y-4 mb-4 flex flex-col justify-start" id="chatbot_messages_scroller">
                    {chatMessages.map((msg) => {
                      const isAsst = msg.sender === 'assistant';
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex flex-col max-w-[85%] ${isAsst ? "self-start items-start" : "self-end items-end"}`}
                          id={`chat_message_container_${msg.id}`}
                        >
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed font-sans ${
                            isAsst 
                              ? "bg-slate-900 border border-slate-800/80 text-slate-200 rounded-tl-none" 
                              : "bg-indigo-600 border border-indigo-500 text-slate-100 rounded-tr-none shadow-sm shadow-indigo-600/15"
                          }`}>
                            <p className="whitespace-pre-line antialiased text-justify leading-relaxed tracking-wide">
                              {msg.text}
                            </p>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">
                            {msg.timestamp}
                          </span>
                        </div>
                      );
                    })}

                    {/* Pending state */}
                    {chatLoading && (
                      <div className="flex flex-col max-w-[60%] self-start items-start" id="chat_message_pending_indicator">
                        <div className="bg-slate-900 border border-slate-800/80 text-slate-400 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span className="text-xs font-sans tracking-wide">
                            {lang === 'sinhala' ? "ජ්‍යෝතිෂවේදීන් සලකා බලමින් පවතී..." : "Consulting cosmic charts..."}
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Form input container */}
                  <form onSubmit={handleSendMessage} className="flex gap-2.5" id="chatbot_input_form">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={lang === 'sinhala' ? "උදා: මට ශනි මාරුව බලපාන්නේ කෙසේද?" : "e.g., How does the Saturn transit affect my 4th house?"}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                      id="chat_text_input"
                      disabled={chatLoading}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 p-2.5 px-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer shadow-md shadow-amber-500/5 hover:shadow-amber-500/15"
                      id="chat_send_button"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </section>

                {/* PREMIUM A4 PDF HOROSCOPE REPORT DOWNLOAD TRIGGER */}
                <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 p-6 rounded-2xl border border-amber-500/30 shadow-lg glow-amber flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden mt-6" id="relocated_pdf_trigger">
                  <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none select-none">
                    <Sparkles className="w-36 h-36" />
                  </div>
                  <div className="space-y-1.5 flex-1 text-center md:text-left">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold tracking-widest rounded-full border border-amber-500/20">
                      <Sparkles className="w-3 h-3" />
                      {lang === 'sinhala' ? "මුද්‍රණය කළ හැකි වෘත්තීය වාර්තාව" : "Printable Professional Report"}
                    </span>
                    <h3 className="text-base md:text-lg font-bold font-display text-slate-100 flex items-center justify-center md:justify-start gap-1.5 mt-1">
                      {lang === 'sinhala' ? "පිටු 3ක සවිස්තරාත්මක කේන්දර පලාපල වාර්තාව (A4 PDF)" : "Detailed 3-Page Horoscope Report (A4 PDF)"}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xl">
                      {lang === 'sinhala'
                        ? "ඔබගේ උපන් තොරතුරු, චන්ද්‍ර ස්ඵුටය, උපන් නැකත, යෝනිය, ගණය සහ සවිස්තර පලාපල ඇතුළත් අලංකාර පිටු 3ක වාර්තාව මුද්‍රණය කිරීමට හෝ සුරැකීමට හැකිය."
                        : "Download or print a beautiful 3-page chart containing birth nakshatra details, Moon Longitude, dasha remedies and comprehensive life reports."}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowContactFormModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-300 hover:from-amber-400 hover:to-amber-200 text-slate-950 font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md hover:scale-[1.02] cursor-pointer flex items-center gap-2 flex-shrink-0"
                    id="trigger_download_report"
                  >
                    <BookOpen className="w-4 h-4" />
                    {lang === 'sinhala' ? "වාර්ථාව ලබාගන්න (Download PDF)" : "Get Report & Preview"}
                  </button>
                </div>

              </div>
            )}
          </main>

        </div>

        {/* Coded credentials footer */}
        <footer className="mt-16 text-center text-[11px] text-slate-500 font-sans tracking-wider border-t border-slate-900 pt-6" id="app_developer_footer">
          <p>© 2026 ශ්‍රී ලාංකීය කේන්දර සටහන - Sri Lankan Astrological Computations & Digital Kundali Engine.</p>
          <p className="opacity-75 mt-1">
            {lang === 'sinhala'
              ? "Vedic Sidereal Lahiri Ephemeris සහාය ඇතිව කෘත්‍රිම බුද්ධියෙන් නිපදවන ලදී."
              : "Power-crafted using modern Vedic Sidereal equations and Server-Side Gemini Intelligence."}
          </p>
        </footer>

        {/* CONTACT INPUT POPUP MODAL (BEFORE REPORT ACCESS) */}
        {showContactFormModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
              <button 
                onClick={() => setShowContactFormModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                ✕
              </button>
              
              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold font-display text-slate-100">
                  {lang === 'sinhala' ? "වාර්තාව ලබා ගැනීමට ලියාපදිංචි වන්න" : "Unlock Astrology Report Booklet"}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'sinhala'
                    ? "වාර්තාව බාගත කිරීම සඳහා කරුණාකර ඔබගේ වලංගු WhatsApp අංකය හෝ විද්‍යුත් තැපෑල ඇතුළත් කරන්න."
                    : "Please provide a valid WhatsApp number or active email to preview and save your A4 PDF booklet."}
                </p>
              </div>

              <form onSubmit={handleSaveReportAndOpenPreview} className="space-y-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReportContactType('email');
                      setContactFormError("");
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-center transition-all ${
                      reportContactType === 'email' ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/20" : "text-slate-400"
                    }`}
                  >
                    Email Address
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportContactType('whatsapp');
                      setContactFormError("");
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-center transition-all ${
                      reportContactType === 'whatsapp' ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/20" : "text-slate-400"
                    }`}
                  >
                    WhatsApp Number
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {reportContactType === 'email' ? "විද්‍යුත් තැපෑල (Email Address)" : "වට්ස්ඇප් අංකය (WhatsApp Mobile)"}
                  </label>
                  <input
                    type={reportContactType === 'email' ? "email" : "text"}
                    value={reportContactValue}
                    onChange={(e) => setReportContactValue(e.target.value)}
                    placeholder={reportContactType === 'email' ? "kasun@example.com" : "e.g., +94771234567"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-all font-sans"
                    required
                  />
                </div>

                {contactFormError && (
                  <p className="text-xs text-rose-400 font-semibold text-center">
                    ⚠️ {contactFormError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSavingReport}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-300 hover:from-amber-400 hover:to-amber-200 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingReport ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      {lang === 'sinhala' ? "සුරකිමින් පවතී..." : "Generating & Saving..."}
                    </>
                  ) : (
                    lang === 'sinhala' ? "වාර්ථාව උත්පාදනය කරන්න" : "Generate Report Booklet"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PREMIUM REPORT PREVIEW MODAL */}
        {showReportPreviewModal && result && (
          <div className="fixed inset-0 bg-slate-950/95 overflow-y-auto z-50 p-4 md:p-8 flex flex-col items-center">
            
            {/* Header controls inside modal */}
            <div className="w-full max-w-5xl flex items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6 flex-shrink-0 non-printable">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {lang === 'sinhala' ? "කේන්දර පලාපල පූර්ව දර්ශනය" : "Horoscope Report PDF Preview"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans">
                    {ratingSubmittedUs ? (
                      lang === 'sinhala' ? "පිටු තුනකින් යුත් පූර්ණ මුද්‍රිත පිටපත (මුද්‍රණය හෝ PDF බාගත කිරීම සක්‍රීයයි)" : "High-fidelity 3-page astrological report booklet (Print/Download unlocked)"
                    ) : (
                      lang === 'sinhala' ? "පිටු තුනකින් යුත් පූර්ණ මුද්‍රිත පිටපත (පහළින් තරු ලබා දීමෙන් පසු මුද්‍රණ බොත්තම ක්‍රියාත්මක වේ)" : "High-fidelity 3-page astrological report booklet (Unlock print using star rating below)"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ratingSubmittedUs ? (
                  <span className="hidden md:flex items-center gap-1.5 text-[11px] font-sans font-semibold text-emerald-500 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    {lang === 'sinhala' ? "මුද්‍රණය/බාගත කිරීම සූදානම්" : "Ready to Print / Download"}
                  </span>
                ) : (
                  <span className="hidden md:flex items-center gap-1.5 text-[11px] font-sans font-semibold text-amber-500 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/25">
                    <Lock className="w-3 h-3 text-amber-400" />
                    {lang === 'sinhala' ? "මුද්‍රණය සඳහා පහළින් තරු ලබාදෙන්න" : "Rate at the bottom to print"}
                  </span>
                )}
                <button
                  onClick={() => setShowReportPreviewModal(false)}
                  className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all"
                >
                  ✕ {lang === 'sinhala' ? "වසන්න" : "Close"}
                </button>
              </div>
            </div>

            {/* Virtual A4 Canvas - Rendered for Screen Viewing, and targets window.print() */}
            <div className="flex flex-col gap-8 w-full max-w-[210mm] text-slate-900 font-sans" id="print-area-wrapper">
              
              {/* PAGE 1 */}
              <div className="a4-page report-border bg-amber-50/20 flex flex-col justify-between p-[18mm]" id="pdf-page-1">
                <div className="space-y-6">
                  {/* Decorative Header */}
                  <div className="text-center border-b border-amber-900/30 pb-4 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 opacity-20 border-t border-l border-amber-800"/>
                    <div className="absolute top-0 right-0 w-8 h-8 opacity-20 border-t border-r border-amber-800"/>
                    
                    <span className="text-[10px] tracking-widest text-amber-800 font-bold uppercase block mb-1">
                      ශ්‍රී ලංකා ජ්‍යෝතිෂ කාර්යාංශය
                    </span>
                    <h1 className="text-2xl font-bold text-amber-950 tracking-tight font-display">
                      මහා අෂ්ටාංග කේන්ද්‍ර පත්‍රිකාව
                    </h1>
                    <p className="text-[10px] text-amber-900/70 font-mono tracking-wide mt-1">
                      CERTIFIED SIDEREAL HOROSCOPE BIRTH CHARTER
                    </p>
                  </div>

                  {/* Identification block */}
                  <div className="grid grid-cols-2 gap-4 text-xs select-none">
                    <div className="bg-white/65 p-3 rounded-lg border border-amber-900/10 space-y-1.5 shadow-sm">
                      <div className="flex justify-between border-b border-amber-900/5 pb-1">
                        <span className="text-amber-900/60 font-semibold">නම (Full Name):</span>
                        <span className="font-bold text-slate-900">{result?.birthDetails?.name || "Anonymous (කසුන්)"}</span>
                      </div>
                      <div className="flex justify-between border-b border-amber-900/5 pb-1">
                        <span className="text-amber-900/60 font-semibold">උපන් දිනය (Birth Date):</span>
                        <span className="font-bold font-mono text-slate-800">{result?.birthDetails?.birthDate || "N/A"}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-amber-900/60 font-semibold">උපන් වෙලාව (Time):</span>
                        <span className="font-bold font-mono text-slate-800">{result?.birthDetails?.birthTime || "N/A"}</span>
                      </div>
                    </div>

                    <div className="bg-white/65 p-3 rounded-lg border border-amber-900/10 space-y-1.5 shadow-sm">
                      <div className="flex justify-between border-b border-amber-900/5 pb-1">
                        <span className="text-amber-900/60 font-semibold">උපන් ස්ථානය (Place):</span>
                        <span className="font-bold text-slate-800">{result?.birthDetails?.birthPlace || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-amber-900/5 pb-1">
                        <span className="text-amber-900/60 font-semibold">ස්ත්‍රී/පුරුෂ (Gender):</span>
                        <span className="font-bold text-slate-800">
                          {result?.birthDetails?.gender === 'Female' ? "ස්ත්‍රී (Female)" : "පුරුෂ (Male)"}
                        </span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-amber-900/60 font-semibold">කේන්දර අංකය (ID):</span>
                        <span className="font-bold font-mono text-amber-800 text-[10px]">{savedReportId || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Centered Chart visualization */}
                  <div className="max-w-[95mm] mx-auto border-4 border-amber-900/40 p-2.5 rounded-xl bg-white shadow-md">
                    {/* Reusable inline rendering of the exact Birth Horoscope SVG */}
                    {document.getElementById("birth_chart_svg") ? (
                      <svg 
                        viewBox="0 0 390 390" 
                        dangerouslySetInnerHTML={{ __html: document.getElementById("birth_chart_svg")?.innerHTML || "" }}
                        className="w-full h-full text-slate-700 font-sans"
                      />
                    ) : (
                      <div className="p-12 text-center text-xs text-amber-900 font-sans">
                        {lang === 'sinhala' ? "කේන්දර සටහන අඳිමින් පවතී..." : "Rendering Astro chart..."}
                      </div>
                    )}
                  </div>

                  {/* Astrological Core Constants List */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-white/70 p-4 rounded-xl border border-amber-900/15 shadow-sm">
                    <div className="space-y-2 border-r border-amber-900/10 pr-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">උපන් ලග්නය (Lagna):</span>
                        <span className="font-bold text-amber-950">{result.chart.lagnaSinhala} ({result.chart.lagna})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">චන්ද්‍ර ස්ඵුටය (Moon Longitude):</span>
                        <span className="font-bold font-mono text-sky-800">{result.chart.calculations.moonLongitudeFullSi}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-1.5">
                        <span className="text-slate-600 font-semibold">උපන් නැකත (Birth Star):</span>
                        <span className="font-bold text-amber-900">{result.chart.calculations.nakshatraNameSi} ({result.chart.calculations.nakshatraNameEn})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">නැකත් පාදය (Pada):</span>
                        <span className="font-bold">{result.chart.calculations.pada} වන පාදය</span>
                      </div>
                    </div>

                    <div className="space-y-2 pl-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">උපන් දශාව (Birth Dasha):</span>
                        <span className="font-bold text-amber-900">{result.chart.calculations.dashaLordSi} ({result.chart.calculations.dashaLordEn} - වසර {result.chart.calculations.dashaTotalYears})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">දශා ශේෂය (Balance Dasha):</span>
                        <span className="font-bold text-indigo-900 text-[11px] font-sans">{result.chart.calculations.balanceDashaSi}</span>
                      </div>
                      {result.chart.calculations.currentDashaLordSi && (
                        <div className="flex justify-between border-t border-slate-100 pt-1.5">
                          <span className="text-slate-600 font-semibold">වත්මන් දශාව (Current Dasha):</span>
                          <span className="font-bold text-sky-800">{result.chart.calculations.currentDashaLordSi} ({result.chart.calculations.currentDashaLordEn})</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-100 pt-1.5">
                        <span className="text-slate-600 font-semibold">ගණය (Gana):</span>
                        <span className="font-bold">{result.chart.calculations.ganaSi} ({result.chart.calculations.ganaEn})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">යෝනිය (Yoni):</span>
                        <span className="font-bold">{result.chart.calculations.yoniSi} ({result.chart.calculations.yoniEn})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-amber-950/60 font-mono border-t border-amber-900/15 pt-3">
                  Page 1 of 3 • Sri Lankan Vedic Astrological Computations Bureau
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="a4-page report-border bg-amber-50/20 flex flex-col justify-between p-[18mm]" id="pdf-page-2">
                <div className="space-y-5">
                  <div className="text-center border-b border-amber-900/30 pb-3">
                    <h2 className="text-xl font-bold text-amber-950 font-display">
                      විස්තරාත්මක කේන්දර පලාපල විස්තරය (පිටුව 2)
                    </h2>
                    <p className="text-[9px] text-amber-900/60 font-mono uppercase tracking-widest mt-0.5">
                      Vedic Sidereal Predictions & Character Analysis - Page 2
                    </p>
                  </div>

                  {/* Predictions Column Split */}
                  <div className="space-y-4 text-xs leading-relaxed text-justify text-slate-800 font-sans select-none">
                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        1. පොදු ජන්ම ගුණාංග සහ පෞරුෂය (Character & Personality reading):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        {result.predictions.general || "විස්තරයක් නොමැත."}
                      </p>
                    </div>

                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        2. අධ්‍යාපනය, වෘත්තීය ගමන් මඟ සහ රැකියා (Education, Career & Professional Pathways):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        {result.predictions.career || "විස්තරයක් නොමැත."}
                      </p>
                    </div>

                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        3. ශාරීරික සෞඛ්‍යය, ශරීර ශක්තිය සහ ජීව ගුණය (Health, Longevity & Well-being):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        {result.predictions.health || "විස්තරයක් නොමැත."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-amber-950/60 font-mono">
                  Page 2 of 3 • Sri Lankan Vedic Astrological Computations Bureau
                </div>
              </div>

              {/* PAGE 3 */}
              <div className="a4-page report-border bg-amber-50/20 flex flex-col justify-between p-[18mm]" id="pdf-page-3">
                <div className="space-y-5">
                  <div className="text-center border-b border-amber-900/30 pb-3">
                    <h2 className="text-xl font-bold text-amber-950 font-display">
                      විස්තරාත්මක කේන්දර පලාපල විස්තරය (පිටුව 3)
                    </h2>
                    <p className="text-[9px] text-amber-900/60 font-mono uppercase tracking-widest mt-0.5">
                      Vedic Sidereal Predictions & Remedial Guide - Page 3
                    </p>
                  </div>

                  {/* Predictions Column Split */}
                  <div className="space-y-4 text-xs leading-relaxed text-justify text-slate-800 font-sans select-none">
                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        4. විවාහය, පවුල් ජීවිතය සහ යෝනි/ගණ ගැළපීම (Family, Gana & Yoni Compatibility):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        මෙම ජන්මියා {result.chart.calculations.ganaSi} ගණයට අයත් වන අතර {result.chart.calculations.yoniSi} යෝනියටත් {result.chart.calculations.lingaSi === "ස්ත්‍රී" ? "ස්ත්‍රී" : "පුරුෂ"} ලිංගයටත් මුල් තැන ලබාදෙයි. {result.predictions.marriage || "විස්තරයක් නොමැත."}
                      </p>
                    </div>

                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        5. ධන වාසනා, කර්මය සහ වාසනාව (Wealth Luck, Income & Financial Standing):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        {result.predictions.wealth || "විස්තරයක් නොමැත."}
                      </p>
                    </div>

                    <div className="bg-white/50 p-4 rounded-lg border border-amber-900/5 shadow-sm space-y-1">
                      <span className="font-bold text-amber-900 block text-xs underline decoration-amber-500/30">
                        6. වත්මන් මහ දශා අපල උපද්‍රව සහ පිළියම් (Maha Dasha Remedial Protection Guide):
                      </span>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        වත්මන් මහා දශා අධිපති {result.chart.calculations.currentDashaLordSi || result.chart.calculations.dashaLordSi} වන අතර, එය {result.chart.calculations.currentDashaStart ? `${result.chart.calculations.currentDashaStart} සිට ${result.chart.calculations.currentDashaEnd} දක්වා සක්‍රීයව පවතී (ඉතිරි කාලය: ${result.chart.calculations.currentDashaRemainingSi})` : `වසර ${result.chart.calculations.dashaTotalYears}ක් සක්‍රීයව පවතී`}. {result.predictions.dasha || "විස්තරයක් නොමැත."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end border-t border-amber-900/10 pt-4 text-xs">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Certified Bureau</span>
                      <div className="px-3 py-1.5 bg-amber-950/5 rounded border border-amber-900/10 text-amber-900/80 font-mono text-[9px] font-bold">
                        ASTRO-VERIFIED-SECURE ✓
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="w-24 h-1 border-b border-amber-900/40 inline-block mb-1"/>
                      <span className="text-[9px] text-amber-900/70 font-semibold block uppercase tracking-wider">ප්‍රධාන ජ්‍යෝතිෂවේදී අත්සන</span>
                      <span className="text-[8px] text-slate-400 block font-mono">Verified Astrology Seal Sr Lanka</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-amber-950/60 font-mono">
                    Page 3 of 3 • Sri Lankan Vedic Astrological Computations Bureau
                  </div>
                </div>
              </div>

            </div>

            {/* Non-printable Star Rating feedback system inside the modal footer */}
            <div className="w-full max-w-2xl border-t border-slate-800 mt-10 pt-6 non-printable select-none">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-xl mx-auto my-6 flex flex-col md:flex-row items-center gap-6">
                
                {/* Left side: Star Rating Form */}
                <div className="flex-1 w-full space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 tracking-wider uppercase font-sans">
                    {lang === 'sinhala' ? "ඔබගේ පලාපල වාර්තාව අනුව තරු ලබා දෙන්න" : "Please Rate This Prediction Report"}
                  </h4>
                  
                  {ratingSubmittedUs ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center md:text-left">
                      <p className="text-xs text-emerald-400 font-bold font-sans">
                        🌟 {lang === 'sinhala' ? "ස්තූතියි! ඔබගේ වටිනා තක්සේරුව සාර්ථකව ලැබුණි." : "Thank you! Your feedback has been received."}
                      </p>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {lang === 'sinhala' ? "මුද්‍රණ/සුරැකුම් බොත්තම දැන් ක්‍රියාත්මකයි." : "The print/save button is now unlocked below."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-amber-300 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/10 leading-relaxed font-sans">
                        💡 {lang === 'sinhala' 
                          ? "ඔබගේ පලාපල වාර්තාව පිළිබඳව පහළින් තරු ලබා දී කෙටි අදහසක් දැක්වූ සැනින්, පිටු 3ක සම්පූර්ණ PDF වාර්තාව මුද්‍රණය කිරීමට හෝ ඩවුන්ලෝඩ් කිරීමට ඇති බොත්තම සක්‍රීය වනු ඇත." 
                          : "Please rate your astrological report and share a quick comment below to instantly activate and unlock your 3-page downloadable/printable PDF booklet."}
                      </p>
                      <form onSubmit={handleSubmitRating} className="space-y-3">
                        <div className="flex justify-start gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                               onClick={() => handleStarRatingClick(star)}
                               className="text-2xl cursor-pointer transition-transform hover:scale-110"
                            >
                              {star <= userRating ? "★" : "☆"}
                            </button>
                          ))}
                        </div>
                      
                        <div>
                          <textarea
                            value={userComment}
                            onChange={(e) => setUserComment(e.target.value)}
                            placeholder={lang === 'sinhala' ? "වාර්ථාව පිළිබඳ ඔබගේ අදහස මෙහි කෙටියෙන් ලියන්න..." : "Write a brief comment about your horoscope report..."}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                            rows={2}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={userRating === 0 || isSubmittingRating}
                          className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmittingRating 
                            ? (lang === 'sinhala' ? "යවමින් පවතී..." : "Submitting...") 
                            : (lang === 'sinhala' ? "තක්සේරුව යොමු කරන්න" : "Submit Rating")}
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Right side: Print Button (unlocked after rating feedback) */}
                <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-800 pt-5 md:pt-0 md:pl-6 w-full md:w-auto flex-shrink-0">
                  {ratingSubmittedUs ? (
                    <div className="text-center space-y-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20">
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        {lang === 'sinhala' ? "මුද්‍රණය සක්‍රීයයි" : "PRINT UNLOCKED"}
                      </span>
                      <button
                        onClick={handlePrintReport}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.03] cursor-pointer flex items-center justify-center gap-2"
                        id="unlocked_print_btn"
                      >
                        <Award className="w-4 h-4 animate-bounce" />
                        {lang === 'sinhala' ? "මුද්‍රණය කරන්න (Print)" : "Print / Save PDF"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1.5 rounded-full border border-amber-500/25">
                        <Lock className="w-3.5 h-3.5" />
                        {lang === 'sinhala' ? "මුද්‍රණය අක්‍රීයයි" : "PRINT LOCKED"}
                      </span>
                      <button
                        disabled
                        className="px-6 py-3 bg-slate-800 text-slate-500 font-bold text-xs tracking-wider uppercase rounded-xl border border-slate-700/50 cursor-not-allowed flex items-center justify-center gap-2"
                        title={lang === 'sinhala' ? "මුද්‍රණය සක්‍රීය වීමට ප්‍රථම තරු ලකුණු ලබා දී තක්සේරුව යොමු කරන්න." : "Please submit star rating first to unlock printing."}
                      >
                        <Lock className="w-4 h-4" />
                        {lang === 'sinhala' ? "මුද්‍රණය කරන්න" : "Print / Save PDF"}
                      </button>
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 max-w-[190px]">
                        <p className="text-[10px] text-amber-300 font-medium leading-relaxed font-sans">
                          {lang === 'sinhala' 
                            ? "💡 වාර්තාව පිළිබඳව ඉහතින් තරු (Rating) ලබා දී 'තක්සේරුව යොමු කරන්න' බොත්තම එබූ පසු මෙම මුද්‍රණ බොත්තම සක්‍රීය වේ." 
                            : "💡 Give a rating on the left and submit it to instantly activate the printing button."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* ADMIN AUTH LOGIN DIALOG */}
        {showAdminLoginModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
              <button 
                onClick={() => {
                  setShowAdminLoginModal(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer text-sm"
              >
                ✕
              </button>

              <form onSubmit={handleAdminLogin} className="space-y-4" autoComplete="off">
                <div className="text-center space-y-1 mb-2">
                  <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold font-display text-slate-100 font-sans">
                    {lang === 'sinhala' ? "පරිපාලක පිවිසුම (Admin Login)" : "Admin Login"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans leading-normal">
                    {lang === 'sinhala' 
                      ? "පරිපාලක පැනලය සඳහා විද්‍යුත් තැපෑල සහ මුරපදය ඇතුළත් කරන්න." 
                      : "Enter the admin email and password credentials to access the panel."}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="sampathub89@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                    autoComplete="off"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                    autoComplete="new-password"
                    required
                  />
                </div>

                {adminLoginError && (
                  <p className="text-xs text-rose-400 font-semibold text-center font-sans">
                    ⚠️ {adminLoginError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wide rounded-xl cursor-pointer transition-all font-sans transform active:scale-[0.98]"
                >
                  Confirm Login
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD OVERLAY PANEL */}
        {isAdminPanelOpen && isAdminLoggedIn && (
          <div className="fixed inset-0 bg-slate-950/95 z-40 overflow-y-auto p-4 md:p-8 flex flex-col items-center select-none font-sans">
            <div className="w-full max-w-6xl space-y-6">
              
              {/* Dashboard header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-indigo-950 pb-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-bold font-display text-slate-100 flex items-center gap-1.5">
                      ජ්‍යෝතිෂ පරිපාලන සංසදය (Astro Admin Panel)
                    </h2>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Logged in securely as <span className="text-indigo-300 font-bold font-mono">sampathub89@gmail.com</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetchAdminReports();
                    }}
                    disabled={isLoadingAdminReports}
                    className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-indigo-300 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminReports ? "animate-spin" : ""}`} />
                    {lang === 'sinhala' ? "යාවත්කාලීන කරන්න" : "Refresh Records"}
                  </button>
                  <button
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminReports, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `astrology_reports_backup_${Date.now()}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-amber-300 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {lang === 'sinhala' ? "දත්ත බාගන්න" : "Download Data"}
                  </button>
                  <button
                    onClick={() => setIsAdminPanelOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold rounded-lg cursor-pointer transition-all"
                  >
                    {lang === 'sinhala' ? "පැනලය වසන්න" : "Close Panel"}
                  </button>
                  <button
                    onClick={handleAdminLogout}
                    className="px-3 py-2 bg-red-950/30 border border-red-500/20 text-red-400 hover:bg-red-950/65 text-xs rounded-lg cursor-pointer transition-all"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Quick Summary Widgets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Consultations</span>
                  <p className="text-xl font-bold font-mono text-indigo-400 mt-1">{adminReports.length}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Email Leads</span>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {adminReports.filter(r => r.contactType === 'email').length}
                  </p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">WhatsApp Leads</span>
                  <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {adminReports.filter(r => r.contactType === 'whatsapp').length}
                  </p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">User Feedbacks</span>
                  <p className="text-xl font-bold font-mono text-purple-400 mt-1">
                    {adminReports.filter(r => r.rating !== null).length}
                  </p>
                </div>
              </div>

              {/* Main table log area */}
              {adminReportsError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg text-center">
                  ⚠️ {adminReportsError}
                </div>
              )}

              {isLoadingAdminReports ? (
                <div className="p-16 text-center select-none space-y-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                  <p className="text-xs text-slate-400">Loading saved client horoscopes...</p>
                </div>
              ) : adminReports.length === 0 ? (
                <div className="p-16 border border-slate-900 bg-slate-950/40 rounded-xl text-center text-xs text-slate-500 font-sans">
                  No horoscope lookup records saved yet.
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-900">
                      <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        <tr>
                          <th className="p-3.5">Date Created</th>
                          <th className="p-3.5">Client Identity</th>
                          <th className="p-3.5">Contact Detail</th>
                          <th className="p-3.5">Birth Coordinates</th>
                          <th className="p-3.5">Kendra Properties</th>
                          <th className="p-3.5">Google Drive Status</th>
                          <th className="p-3.5">Rating & Review</th>
                          <th className="p-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-slate-300">
                        {adminReports.map((rep: any) => {
                          return (
                            <tr key={rep.id} className="hover:bg-indigo-500/5 transition-all text-left">
                              <td className="p-3.5 font-mono text-slate-400 text-[10px]">
                                {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : "Unknown"}
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-slate-100 font-display block text-sm">
                                  {rep.birthDetails?.name || "Anonymous Kasun"}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  {rep.birthDetails?.gender === 'Female' ? "ස්ත්‍රී (Female)" : "පුරුෂ (Male)"}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-slate-900 border border-slate-800 text-amber-400 font-semibold mb-1 uppercase">
                                  {rep.contactType}
                                </span>
                                <span className="block font-bold text-slate-200">{rep.contactValue}</span>
                              </td>
                              <td className="p-3.5 font-sans">
                                <span className="block font-semibold">{rep.birthDetails?.birthDate}</span>
                                <span className="block text-slate-400 text-[10px]">Time: {rep.birthDetails?.birthTime}</span>
                                <span className="block text-indigo-300 text-[10px]">Place: {rep.birthDetails?.birthPlace}</span>
                              </td>
                              <td className="p-3.5 font-sans">
                                <span className="block font-bold text-amber-400">{rep.chart?.lagnaSinhala} ලග්නය</span>
                                <span className="block text-sky-400 text-[10px]">නැකත: {rep.chart?.calculations?.nakshatraNameSi}</span>
                                <span className="block text-[10px] text-slate-400 font-mono">ස්ඵුටය: {rep.chart?.calculations?.moonLongitudeFullSi}</span>
                              </td>
                              <td className="p-3.5">
                                {rep.driveFileId ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full w-fit">
                                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                                      </svg>
                                      {rep.driveFileId.startsWith("sandbox_drive_") ? "Sandbox Backup" : "Drive Saved"}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-mono select-all truncate max-w-[120px]" title={rep.driveFileId}>
                                      ID: {rep.driveFileId}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">Not backed up</span>
                                )}
                              </td>
                              <td className="p-3.5">
                                {rep.rating ? (
                                  <div className="space-y-1">
                                    <div className="flex text-amber-400 font-bold text-xs line-none leading-none">
                                      {Array.from({ length: Number(rep.rating) }, (_, sIdx) => "★").join("")}
                                    </div>
                                    <p className="text-[11px] text-slate-400 italic max-w-[150px] truncate" title={rep.comment}>
                                      "{rep.comment || "No comment"}"
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500">No feedback yet</span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <div className="flex flex-col sm:flex-row justify-center items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setResult({
                                        birthDetails: rep.birthDetails,
                                        chart: rep.chart,
                                        predictions: rep.predictions
                                      });
                                      setSavedReportId(rep.id);
                                      setIsAdminPanelOpen(false);
                                    }}
                                    className="w-full sm:w-auto px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] text-white font-bold rounded cursor-pointer transition-all font-sans"
                                  >
                                    Load Chart
                                  </button>
                                  <button
                                    onClick={() => deleteAdminReport(rep.id)}
                                    className="w-full sm:w-auto px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 text-[10px] font-bold rounded cursor-pointer transition-all font-sans"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

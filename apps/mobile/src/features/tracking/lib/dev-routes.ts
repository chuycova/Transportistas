// Rutas de prueba para el panel dev. Datos reales de la DB — permiten cargar
// rutas directamente desde el simulador sin pasar por RoutesScreen.
// Actualizar si cambian las rutas en Supabase.

export interface DevRoute {
  id: string;
  name: string;
  origin: string;
  dest: string;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: Array<{ name: string; lat: number; lng: number; order: number }>;
}

export const DEV_ROUTES: DevRoute[] = [
  {
    id: 'daf00603-dec8-4175-ae22-da4f1fc6f854',
    name: 'Test_003',
    origin: 'M-PinoSuarez',
    dest: 'M-Etiopia',
    waypoints: [
      {lat:19.42442,lng:-99.13324},{lat:19.42353,lng:-99.13338},{lat:19.42228,lng:-99.13364},
      {lat:19.42183,lng:-99.13372},{lat:19.42045,lng:-99.13394},{lat:19.41918,lng:-99.13415},
      {lat:19.41798,lng:-99.13434},{lat:19.41682,lng:-99.13452},{lat:19.41601,lng:-99.13466},
      {lat:19.41475,lng:-99.13482},{lat:19.41334,lng:-99.13505},{lat:19.41243,lng:-99.13521},
      {lat:19.41153,lng:-99.13535},{lat:19.41005,lng:-99.13559},{lat:19.40908,lng:-99.13581},
      {lat:19.40798,lng:-99.13591},{lat:19.40596,lng:-99.13620},{lat:19.40422,lng:-99.13648},
      {lat:19.40401,lng:-99.13669},{lat:19.40396,lng:-99.13691},{lat:19.40366,lng:-99.13718},
      {lat:19.40357,lng:-99.13806},{lat:19.40374,lng:-99.14116},{lat:19.40395,lng:-99.14505},
    ],
    stops: [],
  },
  {
    id: '6f4f5792-be3e-4370-b4d3-0ebf3ab767a9',
    name: 'Test_004',
    origin: 'Merced',
    dest: 'Chimalpopoca',
    waypoints: [
      {lat:19.42565,lng:-99.12563},{lat:19.42583,lng:-99.12683},{lat:19.42627,lng:-99.12980},
      {lat:19.42623,lng:-99.13035},{lat:19.42590,lng:-99.13097},{lat:19.42577,lng:-99.13132},
      {lat:19.42589,lng:-99.13306},{lat:19.42482,lng:-99.13320},{lat:19.42362,lng:-99.13336},
      {lat:19.42235,lng:-99.13364},{lat:19.42191,lng:-99.13371},{lat:19.42071,lng:-99.13390},
      {lat:19.41923,lng:-99.13414},{lat:19.41807,lng:-99.13432},{lat:19.41683,lng:-99.13451},
      {lat:19.41617,lng:-99.13463},{lat:19.41584,lng:-99.13647},{lat:19.41649,lng:-99.13850},
      {lat:19.41857,lng:-99.13826},{lat:19.42040,lng:-99.13803},{lat:19.42147,lng:-99.13791},
    ],
    stops: [],
  },
  {
    id: '3a3a4e04-13d5-4c33-88db-c70b2aa486d8',
    name: 'Napoleon-Playa',
    origin: 'Rubén Darío / Moderna',
    dest: 'Playa Caleta / Marte',
    waypoints: [
      {lat:19.39359,lng:-99.13591},{lat:19.39338,lng:-99.13438},{lat:19.39318,lng:-99.13272},
      {lat:19.39308,lng:-99.13224},{lat:19.39286,lng:-99.13211},{lat:19.39184,lng:-99.13234},
      {lat:19.39109,lng:-99.13255},{lat:19.39029,lng:-99.13281},{lat:19.38929,lng:-99.13302},
      {lat:19.38763,lng:-99.13339},{lat:19.38703,lng:-99.13352},{lat:19.38616,lng:-99.13372},
      {lat:19.38501,lng:-99.13398},{lat:19.38444,lng:-99.13326},{lat:19.38426,lng:-99.13225},
      {lat:19.38402,lng:-99.13091},
    ],
    stops: [],
  },
];

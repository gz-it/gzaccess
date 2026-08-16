export interface MobileFeature {
  id: string;
  title: string;
  phase: number;
}

export const mobilePhaseZeroFeatures: MobileFeature[] = [
  { id: "activation", title: "Activacion por enlace profundo", phase: 1 },
  { id: "face", title: "Carga y estado de rostro", phase: 3 },
  { id: "vehicles", title: "Alta, edicion y baja de vehiculos", phase: 3 },
  { id: "visits", title: "Creacion y cancelacion de visitas", phase: 6 },
];

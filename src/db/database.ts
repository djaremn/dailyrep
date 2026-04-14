import Dexie from 'dexie';

export interface Proyecto {
  id?: number;
  nombre: string;
  fechaCreacion: Date;
}

export interface RegistroDiario {
  id?: number;
  idProyecto: number;
  fecha: string;
  fotosAntes: string[];
  fotosDespues: string[];
  agua: number;
  combustible: number;
  poligonosGeoJSON: string;
}

class AppDatabase extends Dexie {
  proyectos!: Dexie.Table<Proyecto, number>;
  registrosDiarios!: Dexie.Table<RegistroDiario, number>;

  constructor() {
    super('AvanceDiarioDB');
    this.version(1).stores({
      proyectos: '++id, nombre',
      registrosDiarios: '++id, idProyecto, fecha'
    });
  }
}

export const db = new AppDatabase();
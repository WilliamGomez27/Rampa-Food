
export const INFO = {
  appNombre: 'Rampa Food',
  version: '0.8.0',
  fecha: 'Octubre 2026',
  etapa: 'Piloto',
  descripcion:
    'Plataforma para pedir comida y bebida a vendedores que atienden por turnos dentro de un entorno cerrado.',

  desarrollador: {
    nombre: 'William Gomez',
    rol: 'Desarrollo y soporte',
    github: '', // ejemplo: 'https://github.com/tu-usuario' (déjalo vacío para ocultarlo)
  },

  // Si lo dejas vacío, la sección de ayuda no se muestra
  correoAyuda: 'soportewilligomez@gmail.com',

  novedades: [
    {
      version: '0.8.0',
      cambios: [
        //'Entrega en P30, en la entrada principal o escribiendo tu posición',
        'Calificaciones: los compradores califican a los vendedores y viceversa',
        // 'La app ahora se llama Rampa Food',
      ],
    },
    { version: '0.7.1', cambios: ['WhatsApp ahora es opcional: el pedido llega al vendedor de todos modos'] },
    {
      version: '0.7.0',
      cambios: [
        'Notificaciones: pedidos nuevos y cambios de estado, aunque la app esté cerrada',
        'Avisarme: te notificamos cuando el vendedor se conecte',
        'La app se puede instalar en la pantalla de inicio',
      ],
    },
  ],

  // estado: 'Planeado' | 'En desarrollo' | 'Después del piloto'
  proximas: [
    { titulo: 'Resumen de ventas', detalle: 'Cada vendedor verá sus pedidos, ventas y calificaciones', estado: 'Planeado' },
    { titulo: 'Rotación de turnos', detalle: 'Alternar turnos cada 2 o 3 semanas', estado: 'Planeado' },
    { titulo: 'Editar productos', detalle: 'Cambiar nombre, precio y foto de un producto ya creado', estado: 'Planeado' },
    { titulo: 'Pagos digitales', detalle: 'Pagar desde la app con tarjeta o transferencia', estado: 'Después del piloto' },
  ],
}

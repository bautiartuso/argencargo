// Kairo · base de alimentos comunes en Argentina, por 100 g (kcal, proteína, carbohidratos, grasas),
// con una porción típica. Para buscar al instante sin IA; la IA queda para lo que no está acá.
// Valores de tablas USDA / ARGENFOODS, redondeados. Carnes, pastas y cereales: peso cocido salvo aclaración.
//            nombre                              kcal   P     C     G   porción            g   alias
export const FOODS = [
  // Carnes y huevos
  ["Pechuga de pollo", 165, 31, 0, 3.6, "1 pechuga chica", 150, "pollo"],
  ["Muslo de pollo sin piel", 180, 25, 0, 8.5, "1 muslo", 110, "pollo pata"],
  ["Pollo con piel (asado)", 240, 27, 0, 14, "1 presa", 150, ""],
  ["Carne vacuna magra (nalga, cuadril)", 200, 30, 0, 8.5, "1 bife", 180, "bife carne vaca cuadril nalga"],
  ["Bife de chorizo", 270, 27, 0, 18, "1 bife", 250, "carne asado"],
  ["Carne picada común", 250, 26, 0, 16, "1 porción", 150, "picada"],
  ["Carne picada magra", 190, 28, 0, 8, "1 porción", 150, "picada magra"],
  ["Milanesa de carne (frita)", 290, 20, 18, 15, "1 milanesa", 150, ""],
  ["Milanesa de pollo (al horno)", 210, 24, 14, 6, "1 milanesa", 150, ""],
  ["Hamburguesa casera", 240, 24, 2, 15, "1 unidad", 120, ""],
  ["Hamburguesa de paquete", 270, 15, 6, 21, "1 unidad", 80, "patty"],
  ["Cerdo (bondiola)", 270, 25, 0, 18, "1 porción", 150, "bondiola"],
  ["Cerdo (carré, lomo)", 170, 28, 0, 6, "1 porción", 150, "carré lomo cerdo"],
  ["Jamón cocido", 110, 18, 1, 3.5, "1 feta", 20, "jamon"],
  ["Jamón crudo", 250, 28, 0, 15, "1 feta", 15, "jamon crudo"],
  ["Salame", 400, 24, 1, 33, "1 feta", 10, "salamín"],
  ["Chorizo", 330, 17, 1, 29, "1 chorizo", 100, "choripán"],
  ["Morcilla", 280, 13, 2, 25, "1 unidad", 80, ""],
  ["Atún al natural (lata)", 110, 25, 0, 1, "1 lata chica escurrida", 120, "atun"],
  ["Atún en aceite (lata)", 190, 26, 0, 9, "1 lata chica escurrida", 120, "atun"],
  ["Merluza", 90, 18, 0, 1.5, "1 filet", 150, "pescado filet"],
  ["Salmón", 210, 22, 0, 13, "1 porción", 150, "salmon"],
  ["Huevo", 143, 12.6, 0.7, 9.5, "1 unidad", 50, "huevos"],
  ["Clara de huevo", 52, 11, 0.7, 0.2, "1 clara", 33, "claras"],
  // Lácteos
  ["Leche entera", 61, 3.2, 4.8, 3.3, "1 vaso", 200, ""],
  ["Leche descremada", 35, 3.4, 5, 0.1, "1 vaso", 200, "leche desnatada"],
  ["Yogur entero", 75, 3.5, 10, 2.5, "1 pote", 190, "yogurt"],
  ["Yogur descremado", 45, 4, 6, 0.1, "1 pote", 190, "yogurt"],
  ["Yogur griego", 100, 9, 4, 5, "1 pote", 150, "yogurt griego"],
  ["Queso cremoso", 300, 20, 2, 24, "1 porción", 50, ""],
  ["Queso port salut", 290, 22, 1, 22, "1 feta", 30, "portsalut"],
  ["Queso port salut light", 230, 25, 1, 14, "1 feta", 30, "portsalut light"],
  ["Queso untable (casancrem)", 230, 8, 4, 20, "1 cucharada", 20, "casancrem untable"],
  ["Queso rallado", 420, 35, 2, 30, "1 cucharada", 10, "parmesano reggianito"],
  ["Ricota", 140, 11, 3, 9, "1 porción", 100, ""],
  ["Mozzarella", 280, 22, 2, 21, "1 porción", 50, "muzzarella"],
  ["Manteca", 740, 0.5, 0.5, 82, "1 cucharadita", 10, "mantequilla"],
  // Cereales, panes, pastas
  ["Arroz blanco", 130, 2.7, 28, 0.3, "1 taza cocido", 160, "arroz"],
  ["Arroz integral", 123, 2.7, 26, 1, "1 taza cocido", 160, ""],
  ["Fideos", 158, 5.8, 31, 0.9, "1 plato cocido", 200, "pasta tallarines spaghetti"],
  ["Ñoquis", 160, 4, 33, 1, "1 plato", 250, "noquis gnocchi"],
  ["Ravioles", 190, 8, 30, 4, "1 plato", 250, ""],
  ["Papa hervida", 87, 1.9, 20, 0.1, "1 papa mediana", 150, "papas"],
  ["Papa al horno", 110, 2.5, 25, 0.5, "1 papa mediana", 150, "papas horno"],
  ["Papas fritas", 310, 3.5, 41, 15, "1 porción", 150, "fritas"],
  ["Puré de papa", 100, 2, 16, 3, "1 porción", 200, "pure"],
  ["Batata hervida", 90, 1.6, 21, 0.1, "1 batata mediana", 150, "boniato camote"],
  ["Avena", 380, 13, 66, 7, "3 cucharadas", 30, "avena arrollada"],
  ["Granola", 450, 10, 65, 17, "1/2 taza", 45, ""],
  ["Pan francés", 270, 8.5, 55, 1.5, "1 mignon", 50, "pan"],
  ["Pan integral", 250, 10, 44, 3.5, "1 rebanada", 30, "pan lactal integral"],
  ["Pan lactal", 265, 8, 50, 3.5, "1 rebanada", 25, "pan de molde"],
  ["Tostadas de arroz", 390, 8, 82, 3, "1 unidad", 9, "galletas de arroz"],
  ["Galletitas de agua", 420, 10, 70, 11, "1 unidad", 6, "crackers"],
  ["Galletitas dulces", 460, 6, 72, 16, "1 unidad", 8, "galletas"],
  ["Tortilla de trigo (rapidita)", 310, 8, 50, 8, "1 unidad", 40, "wrap rapidita"],
  ["Polenta", 70, 1.6, 15, 0.3, "1 plato cocida", 250, ""],
  ["Quinoa", 120, 4.4, 21, 1.9, "1 taza cocida", 185, ""],
  ["Cuscús", 112, 3.8, 23, 0.2, "1 taza cocido", 160, "couscous"],
  ["Pizza de muzzarella", 270, 11, 32, 11, "1 porción", 120, "pizza"],
  ["Empanada de carne (horno)", 250, 10, 24, 13, "1 unidad", 90, "empanadas"],
  ["Tarta de verdura", 180, 7, 15, 10, "1 porción", 150, "tarta"],
  ["Sándwich de miga (jamón y queso)", 240, 11, 28, 9, "1 unidad", 55, "sanguche miga"],
  ["Medialuna", 400, 7, 50, 19, "1 unidad", 45, "medialunas factura"],
  ["Factura", 380, 6, 52, 16, "1 unidad", 60, "facturas"],
  // Legumbres y proteínas vegetales
  ["Lentejas", 115, 9, 20, 0.4, "1 taza cocidas", 200, "lenteja"],
  ["Garbanzos", 165, 9, 27, 2.6, "1 taza cocidos", 165, "garbanzo"],
  ["Porotos", 130, 8.5, 23, 0.5, "1 taza cocidos", 180, "frijoles alubias"],
  ["Arvejas", 80, 5.4, 14, 0.4, "1/2 taza", 80, "arveja"],
  ["Tofu", 80, 8, 2, 4.5, "1 porción", 100, ""],
  ["Soja texturizada (hidratada)", 110, 17, 8, 1, "1 porción", 100, "carne de soja"],
  // Verduras
  ["Tomate", 18, 0.9, 3.9, 0.2, "1 unidad", 120, ""],
  ["Lechuga", 15, 1.4, 2.9, 0.2, "1 plato", 60, ""],
  ["Zanahoria", 41, 0.9, 10, 0.2, "1 unidad", 70, ""],
  ["Cebolla", 40, 1.1, 9, 0.1, "1/2 unidad", 60, ""],
  ["Zapallo / calabaza", 26, 1, 6.5, 0.1, "1 porción", 150, "calabaza anco"],
  ["Zapallito / zucchini", 17, 1.2, 3, 0.3, "1 unidad", 120, "zuchini"],
  ["Brócoli", 35, 2.8, 7, 0.4, "1 porción", 100, "brocoli"],
  ["Espinaca", 23, 2.9, 3.6, 0.4, "1 porción", 80, "acelga"],
  ["Morrón", 26, 1, 6, 0.3, "1/2 unidad", 60, "pimiento"],
  ["Pepino", 15, 0.7, 3.6, 0.1, "1/2 unidad", 100, ""],
  ["Palta", 160, 2, 8.5, 15, "1/2 unidad", 70, "aguacate"],
  ["Choclo", 96, 3.4, 21, 1.5, "1 choclo", 100, "maíz"],
  ["Champiñones", 22, 3.1, 3.3, 0.3, "1 porción", 80, "hongos"],
  ["Ensalada mixta (lechuga, tomate, cebolla)", 20, 1, 4, 0.2, "1 plato", 150, "ensalada"],
  ["Ensalada rusa", 150, 2.5, 14, 10, "1 porción", 150, ""],
  // Frutas
  ["Banana", 89, 1.1, 23, 0.3, "1 unidad", 120, ""],
  ["Manzana", 52, 0.3, 14, 0.2, "1 unidad", 180, ""],
  ["Naranja", 47, 0.9, 12, 0.1, "1 unidad", 180, ""],
  ["Mandarina", 53, 0.8, 13, 0.3, "1 unidad", 90, ""],
  ["Pera", 57, 0.4, 15, 0.1, "1 unidad", 170, ""],
  ["Frutilla", 32, 0.7, 7.7, 0.3, "1 taza", 150, "frutillas fresa"],
  ["Uva", 69, 0.7, 18, 0.2, "1 racimo chico", 150, "uvas"],
  ["Kiwi", 61, 1.1, 15, 0.5, "1 unidad", 75, ""],
  ["Durazno", 39, 0.9, 10, 0.3, "1 unidad", 150, ""],
  ["Sandía", 30, 0.6, 7.6, 0.2, "1 porción", 250, "sandia"],
  ["Melón", 34, 0.8, 8, 0.2, "1 porción", 200, "melon"],
  ["Ananá", 50, 0.5, 13, 0.1, "1 rodaja", 100, "anana piña"],
  ["Arándanos", 57, 0.7, 14, 0.3, "1 puñado", 60, "arandanos"],
  // Frutos secos, semillas, aceites
  ["Maní", 570, 26, 16, 49, "1 puñado", 30, "mani"],
  ["Almendras", 580, 21, 22, 50, "10 unidades", 12, "almendra"],
  ["Nueces", 650, 15, 14, 65, "4 unidades", 20, "nuez"],
  ["Castañas de cajú", 550, 18, 30, 44, "1 puñado", 30, "cajú"],
  ["Mantequilla de maní", 590, 25, 20, 50, "1 cucharada", 15, "pasta de maní"],
  ["Semillas de chía", 490, 17, 42, 31, "1 cucharada", 10, "chia"],
  ["Semillas de girasol", 580, 21, 20, 51, "1 cucharada", 10, "girasol"],
  ["Aceite de oliva", 884, 0, 0, 100, "1 cucharada", 10, "aceite"],
  ["Aceite de girasol", 884, 0, 0, 100, "1 cucharada", 10, "aceite"],
  ["Mayonesa", 680, 1, 3, 75, "1 cucharada", 15, ""],
  ["Mayonesa light", 330, 1, 8, 33, "1 cucharada", 15, ""],
  // Dulces y snacks
  ["Dulce de leche", 315, 7, 55, 7, "1 cucharada", 20, ""],
  ["Mermelada", 250, 0.3, 62, 0.1, "1 cucharada", 20, ""],
  ["Miel", 304, 0.3, 82, 0, "1 cucharada", 20, ""],
  ["Azúcar", 387, 0, 100, 0, "1 cucharadita", 5, "azucar"],
  ["Chocolate con leche", 535, 7, 58, 30, "1 barra chica", 25, ""],
  ["Chocolate amargo 70 %", 600, 8, 35, 45, "2 cuadraditos", 20, "chocolate negro"],
  ["Alfajor", 440, 5, 65, 18, "1 unidad", 50, "alfajores"],
  ["Helado", 210, 4, 26, 10, "1 bocha", 80, ""],
  ["Barrita de cereal", 400, 6, 70, 10, "1 unidad", 25, "barra cereal"],
  ["Papas fritas de paquete", 540, 6, 52, 35, "1 paquete chico", 40, "lays snack"],
  ["Pochoclo", 390, 12, 78, 4, "1 bolsa chica", 30, "palomitas"],
  // Bebidas
  ["Agua", 0, 0, 0, 0, "1 vaso", 250, ""],
  ["Café con leche", 45, 2.5, 4, 2, "1 taza", 200, "cafe"],
  ["Café solo", 2, 0.1, 0, 0, "1 taza", 150, "cafe"],
  ["Mate cocido / té", 1, 0, 0, 0, "1 taza", 200, "te"],
  ["Jugo de naranja", 45, 0.7, 10, 0.2, "1 vaso", 250, "jugo"],
  ["Gaseosa", 42, 0, 10.6, 0, "1 vaso", 250, "coca cola"],
  ["Gaseosa light / zero", 0, 0, 0, 0, "1 vaso", 250, "coca zero"],
  ["Cerveza", 43, 0.5, 3.6, 0, "1 lata", 350, "birra"],
  ["Vino tinto", 85, 0.1, 2.6, 0, "1 copa", 150, "vino"],
  ["Fernet con coca", 120, 0, 10, 0, "1 vaso", 250, "fernet"],
  ["Bebida isotónica", 26, 0, 6, 0, "1 botella", 500, "gatorade powerade"],
  // Suplementos que son comida
  ["Proteína en polvo (whey)", 400, 80, 8, 6, "1 scoop", 30, "whey proteina batido"],
  ["Batido de proteína con leche", 95, 11, 6, 2.5, "1 vaso con scoop", 230, "licuado proteina"],
  ["Avena con leche y banana", 110, 4, 19, 2.5, "1 bowl", 350, "porridge"],
  ["Licuado de banana con leche", 90, 3, 15, 2.5, "1 vaso", 300, "licuado"],
  // Platos armados
  ["Pollo con arroz", 150, 15, 15, 3, "1 plato", 350, ""],
  ["Carne con puré", 160, 14, 10, 7, "1 plato", 350, ""],
  ["Fideos con salsa de tomate", 140, 5, 26, 2, "1 plato", 300, "pasta con salsa"],
  ["Fideos con crema", 200, 6, 25, 9, "1 plato", 300, ""],
  ["Tortilla de papa", 180, 6, 15, 11, "1 porción", 200, ""],
  ["Guiso de lentejas", 130, 8, 18, 3, "1 plato", 350, "guiso"],
  ["Sopa de verduras", 35, 1.5, 6, 0.8, "1 plato", 300, "sopa"],
  ["Choripán", 320, 14, 28, 17, "1 unidad", 180, "choripan"],
  ["Lomito completo", 230, 14, 22, 10, "1 unidad", 350, "lomo sandwich"],
  ["Hamburguesa completa (pan, queso)", 250, 13, 25, 11, "1 unidad", 250, "burger"],
  ["Sushi", 150, 6, 28, 2, "10 piezas", 300, ""],
  ["Asado (vacío, tira)", 290, 25, 0, 21, "1 porción", 200, "vacio tira asado"],
  ["Provoleta", 340, 25, 2, 26, "1 unidad", 120, ""],
  ["Ensalada César con pollo", 140, 10, 6, 9, "1 plato", 300, "cesar"],
  ["Wrap de pollo", 190, 14, 20, 6, "1 unidad", 250, ""],
  ["Omelette de 2 huevos con queso", 190, 14, 1, 14, "1 unidad", 130, "omelet"],
  ["Panqueque con dulce de leche", 260, 6, 42, 8, "1 unidad", 80, "panqueques"],
];

export const normFood = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").trim();

// Busca por nombre y alias; primero los que empiezan igual, después los que contienen cada palabra.
export function searchFoods(q, limit = 8) {
  const n = normFood(q);
  if (n.length < 2) return [];
  const words = n.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const f of FOODS) {
    const hay = normFood(f[0] + " " + (f[7] || ""));
    if (!words.every(w => hay.includes(w))) continue;
    const name = normFood(f[0]);
    scored.push([name.startsWith(n) ? 0 : name.includes(n) ? 1 : 2, f]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(x => x[1]);
}

// Un alimento de la base en `grams`, listo para guardar. `qty` es el texto que se muestra ("2 unidades (90 g)").
export function foodItem(f, grams, qty) {
  const k = grams / 100;
  return { name: f[0], qty: qty || `${Number(grams).toLocaleString("es-AR")} g`, kcal: Math.round(f[1] * k), protein_g: Math.round(f[2] * k * 10) / 10, carbs_g: Math.round(f[3] * k * 10) / 10, fat_g: Math.round(f[4] * k * 10) / 10 };
}

// La porción "3 cucharadas" (30 g) se puede contar de a una: { n: 3, unit: "cucharada", grams: 10 }.
export function portionUnit(f) {
  const m = String(f[5] || "").match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+(.+)$/);
  if (!m) return null;
  const n = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1].replace(",", "."));
  if (!n) return null;
  return { n, unit: m[2], grams: f[6] / n };
}
const PLURAL = { unidad: "unidades", porción: "porciones", porcion: "porciones", scoop: "scoops" };
export function unitLabel(count, unit) {
  if (count === 1) return unit;
  const [w, ...rest] = unit.split(" ");
  const pl = PLURAL[w] || (/[aeiou]$/.test(w) ? w + "s" : w + "es");
  return [pl, ...rest].join(" ");
}

"""Recetario de comida saludable con opciones para lunes a viernes.

El programa muestra cuatro opciones por día, permite seleccionar una
por cada jornada laboral y genera la lista de insumos necesaria para
las recetas elegidas.
"""

from __future__ import annotations

from collections import Counter, OrderedDict
from typing import Dict, List

Receta = Dict[str, List[str]]
Menu = OrderedDict[str, List[Receta]]


def construir_menu() -> Menu:
    """Devuelve un menú saludable organizado por día de la semana.

    Cada receta incluye un nombre y la lista de insumos necesarios.
    """

    return OrderedDict(
        {
            "Lunes": [
                {
                    "nombre": "Ensalada mediterránea de garbanzos",
                    "ingredientes": [
                        "1 taza de garbanzos cocidos",
                        "1 pepino en cubos",
                        "1/2 pimiento rojo en cubos",
                        "8 tomates cherry",
                        "2 cucharadas de aceite de oliva",
                        "Jugo de 1 limón",
                        "Hojas de perejil fresco",
                    ],
                },
                {
                    "nombre": "Tostadas integrales con aguacate y huevo",
                    "ingredientes": [
                        "2 rebanadas de pan integral",
                        "1 aguacate maduro",
                        "2 huevos",
                        "1/2 limón",
                        "Semillas de chía",
                        "Sal y pimienta",
                    ],
                },
                {
                    "nombre": "Bowl de yogur con granola y frutos rojos",
                    "ingredientes": [
                        "1 taza de yogur natural",
                        "1/2 taza de granola",
                        "1/2 taza de frutos rojos",
                        "1 cucharada de miel",
                        "2 cucharadas de almendras fileteadas",
                    ],
                },
                {
                    "nombre": "Wrap de pollo y espinacas",
                    "ingredientes": [
                        "1 tortilla integral grande",
                        "120 g de pechuga de pollo a la plancha",
                        "1 taza de espinacas frescas",
                        "1/4 taza de hummus",
                        "Rodajas de pepino",
                        "Rodajas de tomate",
                    ],
                },
            ],
            "Martes": [
                {
                    "nombre": "Salmón al horno con verduras",
                    "ingredientes": [
                        "150 g de filete de salmón",
                        "1 calabacín",
                        "1 zanahoria",
                        "1/2 cebolla morada",
                        "1 cucharada de aceite de oliva",
                        "Eneldo fresco",
                        "Limón",
                    ],
                },
                {
                    "nombre": "Quinoa con vegetales salteados",
                    "ingredientes": [
                        "1 taza de quinoa cocida",
                        "1 taza de brócoli",
                        "1/2 taza de zanahoria rallada",
                        "1/2 taza de pimiento amarillo",
                        "1 cucharada de salsa de soya baja en sodio",
                        "1 cucharadita de aceite de sésamo",
                        "Semillas de ajonjolí",
                    ],
                },
                {
                    "nombre": "Crema fría de pepino y aguacate",
                    "ingredientes": [
                        "1 pepino",
                        "1/2 aguacate",
                        "1 taza de yogur griego",
                        "1 diente de ajo",
                        "Hojas de menta",
                        "Sal y pimienta",
                    ],
                },
                {
                    "nombre": "Tacos de pescado a la plancha",
                    "ingredientes": [
                        "2 filetes de pescado blanco",
                        "4 tortillas de maíz",
                        "1 taza de col morada rallada",
                        "1/2 taza de salsa de yogur con limón",
                        "1/4 taza de cilantro fresco",
                        "Gajos de limón",
                    ],
                },
            ],
            "Miércoles": [
                {
                    "nombre": "Pasta integral con pesto de espinacas",
                    "ingredientes": [
                        "150 g de pasta integral",
                        "2 tazas de espinacas",
                        "1/4 taza de nueces",
                        "2 cucharadas de queso parmesano rallado",
                        "2 cucharadas de aceite de oliva",
                        "1 diente de ajo",
                        "Sal y pimienta",
                    ],
                },
                {
                    "nombre": "Buddha bowl de tofu y vegetales",
                    "ingredientes": [
                        "150 g de tofu firme",
                        "1 taza de arroz integral cocido",
                        "1 taza de kale",
                        "1/2 taza de zanahoria en tiras",
                        "1/2 taza de edamames",
                        "2 cucharadas de aderezo de tahini",
                        "Semillas de sésamo",
                    ],
                },
                {
                    "nombre": "Sopa minestrone ligera",
                    "ingredientes": [
                        "1 taza de caldo de verduras",
                        "1/2 taza de frijoles blancos",
                        "1/2 taza de calabacín en cubos",
                        "1/2 taza de zanahoria en cubos",
                        "1/4 taza de apio en cubos",
                        "1/4 taza de pasta corta integral",
                        "Hojas de albahaca",
                    ],
                },
                {
                    "nombre": "Ensalada de lentejas y vegetales asados",
                    "ingredientes": [
                        "1 taza de lentejas cocidas",
                        "1 taza de coliflor asada",
                        "1/2 taza de pimiento rojo asado",
                        "1/2 taza de cebolla morada asada",
                        "2 cucharadas de aceite de oliva",
                        "1 cucharada de vinagre balsámico",
                        "Perejil fresco picado",
                    ],
                },
            ],
            "Jueves": [
                {
                    "nombre": "Pollo al curry suave con arroz integral",
                    "ingredientes": [
                        "150 g de pechuga de pollo",
                        "1/2 taza de leche de coco ligera",
                        "1 cucharada de pasta de curry amarillo",
                        "1 taza de arroz integral cocido",
                        "1/2 taza de chícharos",
                        "1/2 taza de zanahoria en cubos",
                        "Cilantro fresco",
                    ],
                },
                {
                    "nombre": "Hamburguesa de portobello",
                    "ingredientes": [
                        "2 hongos portobello grandes",
                        "2 panes integrales",
                        "1 tomate en rodajas",
                        "1/2 cebolla morada en rodajas",
                        "1/2 taza de rúcula",
                        "2 cucharadas de pesto",
                        "Queso panela ligero",
                    ],
                },
                {
                    "nombre": "Frittata de claras con espárragos",
                    "ingredientes": [
                        "6 claras de huevo",
                        "1 taza de espárragos",
                        "1/2 taza de champiñones",
                        "1/4 taza de queso feta",
                        "1 cucharada de aceite de oliva",
                        "Eneldo fresco",
                    ],
                },
                {
                    "nombre": "Ensalada de farro y remolacha",
                    "ingredientes": [
                        "1 taza de farro cocido",
                        "1 taza de remolacha asada en cubos",
                        "1/2 taza de espinacas baby",
                        "1/4 taza de nueces tostadas",
                        "2 cucharadas de queso de cabra",
                        "Vinagreta de naranja",
                    ],
                },
            ],
            "Viernes": [
                {
                    "nombre": "Tazón de poke de atún",
                    "ingredientes": [
                        "150 g de atún fresco en cubos",
                        "1 taza de arroz de coliflor",
                        "1/2 taza de pepino",
                        "1/2 taza de mango",
                        "1/4 taza de cebolla morada",
                        "2 cucharadas de salsa ponzu",
                        "1 cucharada de semillas de sésamo",
                    ],
                },
                {
                    "nombre": "Pizza integral de verduras",
                    "ingredientes": [
                        "1 base de pizza integral",
                        "1/2 taza de salsa de tomate natural",
                        "1/2 taza de champiñones",
                        "1/2 taza de espinacas",
                        "1/2 taza de pimiento verde",
                        "1/2 taza de queso mozzarella bajo en grasa",
                        "Orégano seco",
                    ],
                },
                {
                    "nombre": "Sopa de miso con fideos de arroz",
                    "ingredientes": [
                        "3 tazas de caldo dashi",
                        "2 cucharadas de pasta de miso",
                        "100 g de tofu suave",
                        "1 taza de fideos de arroz",
                        "1/2 taza de espinacas",
                        "1/4 taza de cebollín",
                        "Algas wakame",
                    ],
                },
                {
                    "nombre": "Ensalada de couscous con garbanzos",
                    "ingredientes": [
                        "1 taza de couscous integral",
                        "1 taza de garbanzos cocidos",
                        "1/2 taza de pepino",
                        "1/2 taza de tomate",
                        "1/4 taza de cebolla morada",
                        "2 cucharadas de aceite de oliva",
                        "Hojas de menta",
                    ],
                },
            ],
        }
    )


def pedir_opcion(dia: str, opciones: List[Receta]) -> Receta:
    """Pide al usuario que elija una receta para un día específico."""

    print(f"\nOpciones saludables para {dia}:")
    for indice, receta in enumerate(opciones, start=1):
        print(f"  {indice}. {receta['nombre']}")

    while True:
        eleccion = input("Selecciona el número de la receta que prefieres: ").strip()
        if eleccion.isdigit():
            posicion = int(eleccion)
            if 1 <= posicion <= len(opciones):
                receta = opciones[posicion - 1]
                print(f"Has elegido: {receta['nombre']}")
                return receta

        print("Entrada no válida. Intenta nuevamente con un número del 1 al 4.")


def generar_lista_insumos(recetas: List[Receta]) -> List[str]:
    """Genera una lista consolidada de insumos a partir de las recetas elegidas."""

    contador = Counter()
    for receta in recetas:
        contador.update(receta["ingredientes"])

    lista = []
    for insumo, cantidad in sorted(contador.items()):
        if cantidad == 1:
            lista.append(f"- {insumo}")
        else:
            lista.append(f"- {insumo} (x{cantidad})")
    return lista


def main() -> None:
    """Ejecuta el flujo principal del recetario."""

    menu = construir_menu()
    recetas_elegidas: List[Receta] = []
    seleccion_por_dia: Dict[str, str] = {}

    print("Bienvenido al recetario de comida saludable.\n")
    for dia, opciones in menu.items():
        receta = pedir_opcion(dia, opciones)
        recetas_elegidas.append(receta)
        seleccion_por_dia[dia] = receta["nombre"]

    print("\nResumen de tu menú semanal:")
    for dia, nombre_receta in seleccion_por_dia.items():
        print(f"- {dia}: {nombre_receta}")

    print("\nLista de insumos para comprar:")
    for renglon in generar_lista_insumos(recetas_elegidas):
        print(renglon)


if __name__ == "__main__":
    main()

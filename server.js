require("dotenv").config();
const express = require("express");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/incubadoraDB";

// Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Sensores y Actuadores",
            version: "1.0.0",
            description: "API para la gestión de sensores y actuadores",
        },
    },
    apis: ["./server.js"], // Archivos donde están los endpoints
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// WebSockets
io.on("connection", (socket) => {
    console.log("Cliente conectado");

    socket.on("nuevoDato", async (data) => {
        try {
            const nuevoRegistro = new SensorActuador(data);
            await nuevoRegistro.save();
            io.emit("datoGuardado", nuevoRegistro);
        } catch (error) {
            console.error("Error al guardar dato", error);
        }
    });

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
    });
});

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(MONGO_URI).then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error al conectar a MongoDB", err));

// Definir el esquema
const sensorSchema = new mongoose.Schema({
  tipo: String,
  nombre: String,
  valor: mongoose.Schema.Types.Mixed,
  unidad: String,
  fechaHora: { type: Date, default: Date.now }
});

const SensorActuador = mongoose.model("SensoresActuadores", sensorSchema);


/**
 * @swagger
 * /sensoresactuadores/separados:
 *   get:
 *     summary: Obtiene sensores y actuadores separados por tipo
 *     responses:
 *       200:
 *         description: Sensores y actuadores separados
 */
app.get("/sensoresactuadores/separados", async (req, res) => {
  try {
    const datos = await SensorActuador.find();
    const sensores = datos.filter((item) => item.tipo.toLowerCase() === "sensor");
    const actuadores = datos.filter((item) => item.tipo.toLowerCase() === "actuador");

    res.json({ sensores, actuadores });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los datos" });
  }
});

/**
 * @swagger
 * /sensoresactuadores:
 *   post:
 *     summary: Crea un nuevo sensor o actuador
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *               nombre:
 *                 type: string
 *               valor:
 *                 type: number
 *               unidad:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registro creado correctamente
 */
app.post("/sensoresactuadores", async (req, res) => {
  try {
    const nuevoRegistro = new SensorActuador(req.body);
    await nuevoRegistro.save();
    io.emit("datoGuardado", nuevoRegistro);
    res.status(201).json(nuevoRegistro);
  } catch (error) {
    res.status(400).json({ error: "Error al crear el registro" });
  }
});

/**
 * @swagger
 * /sensoresactuadores/{id}:
 *   put:
 *     summary: Actualiza un sensor o actuador por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del sensor o actuador a actualizar
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *               nombre:
 *                 type: string
 *               valor:
 *                 type: number
 *               unidad:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registro actualizado correctamente
 *       404:
 *         description: No encontrado
 */
app.put("/sensoresactuadores/:id", async (req, res) => {
  try {
    const actualizado = await SensorActuador.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizado) return res.status(404).json({ error: "No encontrado" });
    io.emit("datoActualizado", actualizado);
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar" });
  }
});

/**
 * @swagger
 * /sensoresactuadores/{id}:
 *   delete:
 *     summary: Elimina un sensor o actuador por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del sensor o actuador a eliminar
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registro eliminado correctamente
 *       404:
 *         description: No encontrado
 */
app.delete("/sensoresactuadores/:id", async (req, res) => {
  try {
    const eliminado = await SensorActuador.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: "No encontrado" });
    io.emit("datoEliminado", eliminado);
    res.json({ mensaje: "Registro eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

/**
 * @swagger
 * /sensoresactuadores/buscar/{id}:
 *   get:
 *     summary: Obtiene un sensor o actuador por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del sensor o actuador a buscar
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sensor o actuador encontrado
 *       404:
 *         description: No encontrado
 */
app.get("/sensoresactuadores/buscar/:id", async (req, res) => {
  try {
    const dispositivo = await SensorActuador.findById(req.params.id);
    if (!dispositivo) {
      return res.status(404).json({ error: "Dispositivo no encontrado" });
    }
    res.json(dispositivo);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar el dispositivo" });
  }
});

/**
 * @swagger
 * /sensoresactuadores/buscar:
 *   get:
 *     summary: Busca sensores o actuadores por nombre o tipo
 *     parameters:
 *       - in: query
 *         name: nombre
 *         required: false
 *         description: Nombre del sensor o actuador a buscar
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipo
 *         required: false
 *         description: Tipo de dispositivo (sensor o actuador)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de dispositivos encontrados
 *       404:
 *         description: No se encontraron dispositivos
 */
app.get("/sensoresactuadores/buscar", async (req, res) => {
  const { nombre, tipo } = req.query;

  // Si no se pasa nada en los parámetros, se retornan todos los dispositivos
  if (!nombre && !tipo) {
    return res.status(400).json({ error: "Debe proporcionar al menos un parámetro 'nombre' o 'tipo'" });
  }

  const query = {};

  // Si se proporciona un nombre, buscaremos dispositivos que coincidan con él (sin importar mayúsculas/minúsculas)
  if (nombre) {
    query.nombre = new RegExp(nombre, "i"); // 'i' es para hacer la búsqueda insensible a mayúsculas
  }

  // Si se proporciona un tipo, buscaremos dispositivos del tipo dado
  if (tipo) {
    // Si el tipo es 'sensores', lo convertimos en 'sensor'. 
    // Si el tipo es 'actuadores', lo convertimos en 'actuador'.
    if (tipo.toLowerCase() === "sensores") {
      query.tipo = "sensor";
    } else if (tipo.toLowerCase() === "actuadores") {
      query.tipo = "actuador";
    } else {
      return res.status(400).json({ error: "El tipo debe ser 'sensores' o 'actuadores'" });
    }
  }

  try {
    const dispositivos = await SensorActuador.find(query);

    // Si no se encontraron dispositivos, devolver error 404
    if (dispositivos.length === 0) {
      return res.status(404).json({ error: "No se encontraron dispositivos" });
    }

    // Si se encontraron dispositivos, devolverlos
    res.json(dispositivos);
  } catch (error) {
    res.status(500).json({ error: "Error al realizar la búsqueda" });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Swagger Docs en http://localhost:${PORT}/api-docs`);
});
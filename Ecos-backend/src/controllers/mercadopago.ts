import { Request, Response } from "express";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

const preference = new Preference(client);

// Mapeo de servicios con sus rutas y datos
const SERVICES_CONFIG: Record<
  string,
  {
    path: string;
    defaultName: string;
    defaultDescription: string;
    defaultPrice: number;
  }
> = {
  "1": {
    path: "descripcion-cartas",
    defaultName: "Lectura de cartas tarot",
    defaultDescription:
      "Lectura personalizada de cartas del tarot con interpretación detallada",
    defaultPrice: 15000,
  },
  "2": {
    path: "significado-suenos",
    defaultName: "Significado de Sueños",
    defaultDescription: "Interpretación profesional de tus sueños",
    defaultPrice: 12000,
  },
  "3": {
    path: "Informacion-zodiaco",
    defaultName: "Información del Zodiaco",
    defaultDescription: "Análisis completo de tu signo zodiacal",
    defaultPrice: 10000,
  },
  "4": {
    path: "lectura-numerologia",
    defaultName: "Lectura de Numerología",
    defaultDescription: "Descubre el significado de tus números personales",
    defaultPrice: 14000,
  },
  "5": {
    path: "mapa-vocacional",
    defaultName: "Mapa Vocacional",
    defaultDescription: "Descubre tu camino profesional ideal",
    defaultPrice: 18000,
  },
  "6": {
    path: "animal-interior",
    defaultName: "Animal Interior",
    defaultDescription: "Conoce tu animal espiritual guía",
    defaultPrice: 11000,
  },
  "7": {
    path: "tabla-nacimiento",
    defaultName: "Tabla de Nacimiento",
    defaultDescription: "Análisis numerológico de tu fecha de nacimiento",
    defaultPrice: 13000,
  },
  "8": {
    path: "horoscopo",
    defaultName: "Horóscopo Personalizado",
    defaultDescription: "Predicciones detalladas para tu signo",
    defaultPrice: 9000,
  },
  "9": {
    path: "calculadora-amor",
    defaultName: "Calculadora del Amor",
    defaultDescription: "Compatibilidad amorosa y análisis de pareja",
    defaultPrice: 12000,
  },
};

const BASE_URL = "https://d9fa48254b53.ngrok-free.app";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const {
      serviceId = "1",
      amount,
      serviceName,
      firstName = "Usuario",
      lastName = "Ecos",
      email = "usuario@example.com",
      categoryId = "services",
      description,
    } = req.body;

    // Obtener configuración del servicio
    const serviceConfig = SERVICES_CONFIG[serviceId];

    if (!serviceConfig) {
      return res.status(400).send({
        error: "Servicio no válido",
        validServices: Object.keys(SERVICES_CONFIG),
      });
    }

    // Usar valores del request o los defaults del servicio
    const finalAmount = amount || serviceConfig.defaultPrice;
    const finalServiceName = serviceName || serviceConfig.defaultName;
    const finalDescription = description || serviceConfig.defaultDescription;
    const servicePath = serviceConfig.path;

    // Generar external_reference único (incluye el serviceId para el webhook)
    const externalReference = `ECOS-${serviceId}-${Date.now()}`;

    console.log("🔄 Creando orden de MercadoPago...");
    console.log("📋 Datos del pago:");
    console.log("  - Service ID:", serviceId);
    console.log("  - Path de redirección:", servicePath);
    console.log("  - Monto:", finalAmount);
    console.log("  - Servicio:", finalServiceName);
    console.log("  - Comprador:", firstName, lastName);
    console.log("  - Email:", email);
    console.log("  - External Reference:", externalReference);

    const result = await preference.create({
      body: {
        items: [
          {
            id: serviceId,
            title: finalServiceName,
            quantity: 1,
            unit_price: Number(finalAmount),
            category_id: categoryId,
            description: finalDescription,
          },
        ],
        payer: {
          name: firstName,
          surname: lastName,
          email: email,
        },
        back_urls: {
          // ✅ URL dinámica según el servicio
          success: `${BASE_URL}/${servicePath}?status=success&service=${serviceId}`,
          failure: `${BASE_URL}/welcome?status=failure&service=${serviceId}`,
          pending: `${BASE_URL}/welcome?status=pending&service=${serviceId}`,
        },
        notification_url: "https://api.ecosoraculo.com/api/mercadopago/webhook",
        external_reference: externalReference,
        payment_methods: {
          excluded_payment_methods: [{ id: "efecty" }, { id: "pse" }],
          installments: 3,
        },
        auto_return: "approved",
      },
    });

    console.log("✅ Orden creada exitosamente");
    console.log("  - ID:", result.id);
    console.log("  - External Reference:", result.external_reference);
    console.log(
      "  - URL Success:",
      `${BASE_URL}/${servicePath}?status=success`
    );

    res.send({
      ...result,
      serviceInfo: {
        id: serviceId,
        path: servicePath,
        name: finalServiceName,
      },
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).send({ error: "Error creating order" });
  }
};

// Endpoint para obtener información de servicios disponibles
export const getServices = async (req: Request, res: Response) => {
  try {
    const services = Object.entries(SERVICES_CONFIG).map(([id, config]) => ({
      id,
      ...config,
    }));

    res.send({ services });
  } catch (error) {
    console.error("Error getting services:", error);
    res.status(500).send({ error: "Error getting services" });
  }
};

export const receiveWebhook = async (req: Request, res: Response) => {
  try {
    console.log("📨 Webhook received:", req.body);

    // Extraer información del external_reference si está disponible
    const { data, type } = req.body;

    if (type === "payment") {
      console.log("💰 Payment notification received");
      console.log("  - Payment ID:", data?.id);

      // Aquí puedes agregar lógica para:
      // 1. Verificar el pago con la API de MercadoPago
      // 2. Actualizar el estado en tu base de datos
      // 3. Enviar confirmación al usuario
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.status(500).send("Error handling webhook");
  }
};

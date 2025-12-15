import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environmets.prod';

export interface MercadoPagoOrderResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  status: string;
  external_reference: string;
  serviceInfo?: {
    id: string;
    path: string;
    name: string;
  };
}

export interface PaymentStatus {
  isPaid: boolean;
  status: 'approved' | 'pending' | 'rejected' | 'failure' | null;
  paymentId: string | null;
  serviceId: string | null;
  externalReference: string | null;
  collectionStatus: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class MercadopagoService {
  private readonly PAYMENT_DATA_KEY = 'mercadopago_payment_data';
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Crea una orden de pago en MercadoPago
   */
  async createOrder(orderData: {
    amount?: number;
    serviceName?: string;
    serviceId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    categoryId?: string;
    description?: string;
  }): Promise<MercadoPagoOrderResponse> {
    try {
      const url = `${this.apiUrl}api/mercadopago/create-order`;

      const defaultData = {
        amount: 15000,
        serviceName: 'Servicio Ecos del Oráculo',
        serviceId: '1',
        firstName: 'Usuario',
        lastName: 'Ecos',
        email: 'usuario@ecosoraculo.com',
        categoryId: 'services',
        description: 'Servicio espiritual personalizado',
      };

      const data = { ...defaultData, ...orderData };

      console.log('📤 Creando orden de MercadoPago:', data);

      const response = await firstValueFrom(
        this.http.post<MercadoPagoOrderResponse>(url, data)
      );

      console.log('✅ Orden creada:', response);
      return response;
    } catch (error) {
      console.error('❌ Error creando orden de MercadoPago:', error);
      throw error;
    }
  }

  /**
   * ✅ MEJORADO: Verifica el estado del pago desde la URL
   */
  checkPaymentStatusFromUrl(): PaymentStatus {
    const urlParams = new URLSearchParams(window.location.search);

    // MercadoPago puede enviar diferentes parámetros
    const status = urlParams.get('status');
    const collectionStatus = urlParams.get('collection_status');
    const paymentId =
      urlParams.get('payment_id') || urlParams.get('collection_id');
    const serviceId = urlParams.get('service');
    const externalReference = urlParams.get('external_reference');

    console.log('🔍 Analizando URL de pago:');
    console.log('  - status:', status);
    console.log('  - collection_status:', collectionStatus);
    console.log('  - payment_id:', paymentId);
    console.log('  - service:', serviceId);
    console.log('  - external_reference:', externalReference);

    // Determinar si el pago fue aprobado
    // MercadoPago usa collection_status=approved para pagos exitosos
    const isApproved =
      collectionStatus === 'approved' ||
      status === 'approved' ||
      status === 'success';

    const isPending =
      collectionStatus === 'pending' ||
      collectionStatus === 'in_process' ||
      status === 'pending';

    const isRejected =
      collectionStatus === 'rejected' ||
      status === 'rejected' ||
      status === 'failure';

    let finalStatus: 'approved' | 'pending' | 'rejected' | 'failure' | null =
      null;

    if (isApproved) {
      finalStatus = 'approved';
    } else if (isPending) {
      finalStatus = 'pending';
    } else if (isRejected) {
      finalStatus = 'rejected';
    }

    const result: PaymentStatus = {
      isPaid: isApproved,
      status: finalStatus,
      paymentId,
      serviceId,
      externalReference,
      collectionStatus,
    };

    console.log('📊 Resultado del análisis:', result);

    return result;
  }

  /**
   * ✅ NUEVO: Verifica si hay parámetros de pago en la URL
   */
  hasPaymentParams(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.has('collection_status') ||
      urlParams.has('payment_id') ||
      urlParams.has('status')
    );
  }

  /**
   * Guarda datos antes de redirigir al pago
   */
  savePaymentData(data: any): void {
    try {
      const dataToSave = {
        ...data,
        savedAt: new Date().toISOString(),
      };

      // Guardar en localStorage (persiste entre recargas)
      localStorage.setItem(this.PAYMENT_DATA_KEY, JSON.stringify(dataToSave));

      // También guardar una copia de seguridad
      localStorage.setItem(
        `${this.PAYMENT_DATA_KEY}_backup`,
        JSON.stringify(dataToSave)
      );

      console.log('💾 Datos de pago guardados en localStorage');
      console.log('  - Mensajes:', data.messages?.length || 0);
      console.log('  - Contador:', data.userMessageCount);
      console.log('  - ServiceId:', data.serviceId);
    } catch (error) {
      console.error('❌ Error guardando datos de pago:', error);
    }
  }

  /**
   * Recupera datos guardados antes del pago
   */
  getPaymentData(): any {
    try {
      // Intentar recuperar datos principales
      let data = localStorage.getItem(this.PAYMENT_DATA_KEY);

      // Si no existe, intentar el backup
      if (!data) {
        data = localStorage.getItem(`${this.PAYMENT_DATA_KEY}_backup`);
        console.log('📂 Usando datos de backup');
      }

      if (data) {
        const parsed = JSON.parse(data);
        console.log('📂 Datos de pago recuperados:');
        console.log('  - Mensajes:', parsed.messages?.length || 0);
        console.log('  - Contador:', parsed.userMessageCount);
        console.log('  - Guardado en:', parsed.savedAt);
        return parsed;
      }

      console.log('⚠️ No se encontraron datos de pago guardados');
      return null;
    } catch (error) {
      console.error('❌ Error recuperando datos de pago:', error);
      return null;
    }
  }

  /**
   * Limpia los datos de pago guardados
   */
  clearPaymentData(): void {
    try {
      localStorage.removeItem(this.PAYMENT_DATA_KEY);
      localStorage.removeItem(`${this.PAYMENT_DATA_KEY}_backup`);
      console.log('🗑️ Datos de pago eliminados');
    } catch (error) {
      console.error('❌ Error eliminando datos de pago:', error);
    }
  }

  /**
   * Redirige al usuario a la página de pago de MercadoPago
   */
  redirectToPayment(paymentUrl: string): void {
    if (paymentUrl) {
      console.log('🔗 Redirigiendo a MercadoPago:', paymentUrl);
      window.location.href = paymentUrl;
    } else {
      console.error('❌ URL de pago no válida');
      throw new Error('URL de pago no válida');
    }
  }

  /**
   * ✅ NUEVO: Limpia los parámetros de pago de la URL
   */
  cleanPaymentParamsFromUrl(): void {
    const url = new URL(window.location.href);
    const paramsToRemove = [
      'status',
      'collection_status',
      'payment_id',
      'collection_id',
      'external_reference',
      'payment_type',
      'merchant_order_id',
      'preference_id',
      'site_id',
      'processing_mode',
      'merchant_account_id',
      'service',
    ];

    let hasParams = false;
    paramsToRemove.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        hasParams = true;
      }
    });

    if (hasParams) {
      window.history.replaceState({}, document.title, url.pathname);
      console.log('🧹 Parámetros de pago limpiados de la URL');
    }
  }

  /**
   * ✅ NUEVO: Guardar estado de pago por servicio
   */
  saveServicePaymentStatus(serviceId: string, isPaid: boolean): void {
    const key = `service_paid_${serviceId}`;
    sessionStorage.setItem(key, isPaid ? 'true' : 'false');
    console.log(
      `💾 Estado de pago guardado para servicio ${serviceId}:`,
      isPaid
    );
  }

  /**
   * ✅ NUEVO: Verificar si un servicio está pagado
   */
  isServicePaid(serviceId: string): boolean {
    const key = `service_paid_${serviceId}`;
    const isPaid = sessionStorage.getItem(key) === 'true';
    console.log(`🔍 Verificando pago servicio ${serviceId}:`, isPaid);
    return isPaid;
  }
}

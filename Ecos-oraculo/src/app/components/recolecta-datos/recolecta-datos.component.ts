import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecolectaService } from '../../services/recolecta.service';
import { MercadopagoService } from '../../services/mercadopago.service';
import { Datos } from '../../interfaces/datos';

// ✅ Interfaz para configuración del servicio
export interface ServiceConfig {
  serviceId: string;
  serviceName: string;
  amount: number;
  description: string;
}

@Component({
  selector: 'app-recolecta-datos',
  imports: [CommonModule, FormsModule],
  templateUrl: './recolecta-datos.component.html',
  styleUrl: './recolecta-datos.component.css',
})
export class RecolectaDatosComponent {
  // ✅ Eventos de salida
  @Output() onDataSubmitted = new EventEmitter<any>();
  @Output() onModalClosed = new EventEmitter<void>();

  // ✅ NUEVO: Recibir configuración del servicio desde el componente padre
  @Input() serviceConfig: ServiceConfig = {
    serviceId: '1',
    serviceName: 'Lectura de cartas tarot',
    amount: 15000,
    description: 'Lectura personalizada de cartas del tarot'
  };

  // ✅ NUEVO: Modo de operación - solo datos o datos + pago
  @Input() processPayment: boolean = true;

  constructor(
    private recolecta: RecolectaService,
    private mercadopagoService: MercadopagoService
  ) {}

  // Propiedades de datos
  userData: any = {
    email: '',
    firstName: '',
    lastName: '',
  };

  aceptaTerminos = false;
  showTerminosError = false;
  datosVeridicos = false;
  showDatosVeridicosError = false;
  emailNotifications = false;
  dataFormErrors: { [key: string]: string } = {};
  isValidatingData: boolean = false;
  isProcessingPayment: boolean = false;
  attemptedDataSubmission: boolean = false;

  // Método para validar datos
  validateUserData(): boolean {
    this.dataFormErrors = {};
    let isValid = true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.userData.email || !this.userData.email.toString().trim()) {
      this.dataFormErrors['email'] = 'El email es obligatorio';
      isValid = false;
    } else if (!emailRegex.test(this.userData.email.toString().trim())) {
      this.dataFormErrors['email'] = 'Ingresa un email válido';
      isValid = false;
    }

    return isValid;
  }

  hasError(field: string): boolean {
    return this.attemptedDataSubmission && !!this.dataFormErrors[field];
  }

  async submitUserData(): Promise<void> {
    this.attemptedDataSubmission = true;

    if (!this.validateUserData()) {
      return;
    }

    this.showTerminosError = false;
    this.showDatosVeridicosError = false;

    if (!this.aceptaTerminos) {
      this.showTerminosError = true;
      return;
    }

    if (!this.datosVeridicos) {
      this.showDatosVeridicosError = true;
      return;
    }

    this.isValidatingData = true;

    try {
      const datosToSend: Datos = {
        email: (this.userData.email || '').toString().trim(),
      };

      const userDataComplete = {
        email: datosToSend.email,
        firstName: (this.userData.firstName || '').toString().trim() || 'Usuario',
        lastName: (this.userData.lastName || '').toString().trim() || 'Ecos',
      };

      if (!datosToSend.email) {
        this.dataFormErrors['general'] = 'El email es obligatorio';
        this.isValidatingData = false;
        return;
      }

      // Guardar en sessionStorage
      sessionStorage.setItem('userData', JSON.stringify(userDataComplete));

      // Enviar datos al backend
      this.recolecta.createProduct(datosToSend).subscribe({
        next: (response) => console.log('✅ Datos enviados al backend'),
        error: (error) => console.warn('⚠️ Error enviando datos:', error),
      });

      // ✅ Si processPayment es true, procesar pago con MercadoPago
      if (this.processPayment) {
        await this.processPaymentWithMercadoPago(userDataComplete);
      } else {
        // Solo emitir datos sin procesar pago
        this.isValidatingData = false;
        this.onDataSubmitted.emit(userDataComplete);
      }

    } catch (error) {
      console.error('❌ Error:', error);
      this.dataFormErrors['general'] = 'Error inesperado. Por favor, inténtalo de nuevo.';
      this.isValidatingData = false;
      this.isProcessingPayment = false;
    }
  }

  // ✅ NUEVO: Método para procesar pago con MercadoPago
  private async processPaymentWithMercadoPago(userDataComplete: any): Promise<void> {
    this.isProcessingPayment = true;

    try {
      console.log('💳 Creando orden de MercadoPago...');
      console.log('📦 Service Config:', this.serviceConfig);

      // Guardar datos para recuperar después del pago
      const paymentData = {
        userData: userDataComplete,
        serviceConfig: this.serviceConfig,
        timestamp: new Date().toISOString()
      };

      this.mercadopagoService.savePaymentData(paymentData);

      // ✅ Crear orden con el serviceId correcto
      const order = await this.mercadopagoService.createOrder({
        amount: this.serviceConfig.amount,
        serviceName: this.serviceConfig.serviceName,
        serviceId: this.serviceConfig.serviceId, // ✅ ID del servicio correcto
        firstName: userDataComplete.firstName,
        lastName: userDataComplete.lastName,
        email: userDataComplete.email,
        categoryId: 'services',
        description: this.serviceConfig.description
      });

      console.log('✅ Orden creada:', order);

      // Emitir datos antes de redirigir
      this.onDataSubmitted.emit(userDataComplete);

      // Redirigir a MercadoPago
      const paymentUrl = order.sandbox_init_point || order.init_point;
      console.log('🔗 Redirigiendo a:', paymentUrl);
      
      this.mercadopagoService.redirectToPayment(paymentUrl);

    } catch (error: any) {
      console.error('❌ Error al procesar pago:', error);
      this.dataFormErrors['general'] = 'Error al procesar el pago. Intenta nuevamente.';
      this.isValidatingData = false;
      this.isProcessingPayment = false;
    }
  }

  cancelDataModal(): void {
    if (!this.isProcessingPayment) {
      this.onModalClosed.emit();
    }
  }

  // ✅ Getter para mostrar el precio formateado
  get formattedPrice(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(this.serviceConfig.amount);
  }
}
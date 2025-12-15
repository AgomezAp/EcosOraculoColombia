import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  BirthChartRequest,
  BirthChartResponse,
  TablaNacimientoService,
} from '../../services/tabla-nacimiento.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MercadopagoService } from '../../services/mercadopago.service';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import { Observable, map, catchError, of } from 'rxjs';

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}

interface ChartData {
  sunSign?: string;
  moonSign?: string;
  ascendant?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
}

interface AstrologerInfo {
  name: string;
  title: string;
  specialty: string;
}

@Component({
  selector: 'app-tabla-nacimiento',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './tabla-nacimiento.component.html',
  styleUrl: './tabla-nacimiento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaNacimientoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Chat y mensajes
  messages: Message[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Control de scroll
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Datos personales y carta
  chartData: ChartData = {};
  fullName: string = '';
  birthDate: string = '';
  birthTime: string = '';
  birthPlace: string = '';
  showDataForm: boolean = false;

  // Información del astrólogo
  astrologerInfo: AstrologerInfo = {
    name: 'Maestra Emma',
    title: 'Guardiana de las Configuraciones Celestiales',
    specialty: 'Especialista en Cartas Natales y Astrología Transpersonal',
  };

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  birthChartServiceConfig: ServiceConfig = {
    serviceId: '7', // ID del servicio tabla de nacimiento en el backend
    serviceName: 'Tabla de Nacimiento',
    amount: 18000, // $18,000 COP (equivalente a ~4 EUR)
    description: 'Acceso completo a lecturas de carta natal ilimitadas',
  };

  // Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForBirthTable: boolean = false;

  // ✅ Contador de mensajes del usuario para lógica del 2do mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 2;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<TablaNacimientoComponent>,
    private http: HttpClient,
    private tablaNacimientoService: TablaNacimientoService,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.6);
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  async ngOnInit(): Promise<void> {
    console.log('🌟 ====== INICIANDO TABLA DE NACIMIENTO ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForBirthTable =
      sessionStorage.getItem('hasUserPaidForBirthTable_geburtstabelle') ===
        'true' || this.mercadopagoService.isServicePaid('6');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForBirthTable);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForBirthTable = true;
        sessionStorage.setItem(
          'hasUserPaidForBirthTable_geburtstabelle',
          'true'
        );
        this.mercadopagoService.saveServicePaymentStatus('6', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('birthChartBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (
            savedData.conversationHistory &&
            savedData.conversationHistory.length > 0
          ) {
            this.messages = savedData.conversationHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            console.log('💬 Mensajes recuperados:', this.messages.length);
          }

          // Recuperar contador de mensajes
          if (savedData.userMessageCount !== undefined) {
            this.userMessageCount = savedData.userMessageCount;
          }

          // Recuperar datos de usuario
          if (savedData.userData) {
            this.userData = savedData.userData;
            sessionStorage.setItem(
              'userData',
              JSON.stringify(savedData.userData)
            );
          }

          // Recuperar datos de la carta
          if (savedData.chartData) {
            this.chartData = savedData.chartData;
            this.fullName = savedData.chartData.fullName || '';
            this.birthDate = savedData.chartData.birthDate || '';
            this.birthTime = savedData.chartData.birthTime || '';
            this.birthPlace = savedData.chartData.birthPlace || '';
          }
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        const successMessage: Message = {
          sender: 'Maestra Emma',
          content: `✨ **¡Pago confirmado exitosamente!** ✨

🌟 Ahora tienes acceso completo e ilimitado a mis servicios de lectura de carta natal.

Las configuraciones celestiales se revelan ante ti. Puedes preguntarme lo que desees sobre tu carta natal, planetas, casas astrológicas y todos los secretos que las estrellas guardan para ti.

¿Qué aspecto de tu carta natal quieres explorar?`,
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(successMessage);
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem(
          'pendingBirthChartMessage'
        );
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingBirthChartMessage');
          setTimeout(() => {
            this.processBirthChartUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        const pendingMessage: Message = {
          sender: 'Maestra Emma',
          content:
            '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(pendingMessage);
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      } else if (
        paymentStatus.status === 'rejected' ||
        paymentStatus.status === 'failure'
      ) {
        console.log('❌ Pago rechazado o fallido');
        this.paymentError =
          'El pago no se pudo completar. Por favor, intenta nuevamente.';
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      }
    }

    // ✅ PASO 3: Cargar datos del usuario desde sessionStorage
    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    }

    // ✅ PASO 4: Cargar mensajes guardados
    if (this.messages.length === 0) {
      this.loadSavedData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForBirthTable && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('birthChartBlockedMessageId');
    }

    // Mensaje de bienvenida si no hay mensajes
    if (this.messages.length === 0) {
      this.initializeBirthChartWelcomeMessage();
    }

    console.log('🌟 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForBirthTable);
    console.log('  - Mensajes:', this.messages.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private initializeBirthChartWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('birthChartUserMessageCount', '0');

    this.addMessage({
      sender: 'Maestra Emma',
      content: `🌟 ¡Hola, buscador de los secretos celestiales! Soy Emma, tu guía en el cosmos de las configuraciones astrales. 

Estoy aquí para descifrar los secretos ocultos en tu carta natal. Las estrellas han esperado este momento para revelarte su sabiduría.

¿Qué aspecto de tu carta natal deseas explorar primero?`,
      timestamp: new Date(),
      isUser: false,
    });
  }

  ngAfterViewChecked(): void {
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.messages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  private loadSavedData(): void {
    const savedMessages = sessionStorage.getItem('birthChartMessages');
    const savedMessageCount = sessionStorage.getItem(
      'birthChartUserMessageCount'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'birthChartBlockedMessageId'
    );
    const savedChartData = sessionStorage.getItem('birthChartData');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.messages.length;
        console.log('💬 Mensajes cargados de sesión:', this.messages.length);
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.initializeBirthChartWelcomeMessage();
      }
    }

    if (savedChartData) {
      try {
        this.chartData = JSON.parse(savedChartData);
        this.fullName = this.chartData.fullName || '';
        this.birthDate = this.chartData.birthDate || '';
        this.birthTime = this.chartData.birthTime || '';
        this.birthPlace = this.chartData.birthPlace || '';
      } catch (error) {
        console.error('Error parseando datos de carta:', error);
      }
    }
  }

  // ========== MÉTODOS DE ENVÍO DE MENSAJES ==========

  sendMessage(): void {
    if (!this.currentMessage?.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForBirthTable);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForBirthTable) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.shouldScrollToBottom = true;
      this.processBirthChartUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 2do mensaje o posterior (requiere pago)
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingBirthChartMessage', userMessage);

      // Guardar estado antes del pago
      this.saveStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // Procesar mensaje normalmente (primer mensaje gratuito)
    this.shouldScrollToBottom = true;
    this.processBirthChartUserMessage(userMessage);
  }

  private processBirthChartUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem(
      'birthChartUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    // Agregar mensaje del usuario
    const userMsg: Message = {
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;

    // Usar el servicio real de carta natal
    this.generateAstrologicalResponse(userMessage).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;

        const messageId = Date.now().toString();
        const astrologerMsg: Message = {
          sender: 'Maestra Emma',
          content: response,
          timestamp: new Date(),
          isUser: false,
          id: messageId,
        };
        this.messages.push(astrologerMsg);

        // ✅ Verificar si debe bloquear después del 2do mensaje
        if (
          !this.hasUserPaidForBirthTable &&
          this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
        ) {
          this.blockedMessageId = messageId;
          sessionStorage.setItem('birthChartBlockedMessageId', messageId);

          // Mostrar modal de pago después de 2 segundos
          setTimeout(() => {
            this.saveStateBeforePayment();
            this.showPaymentModal = false;

            setTimeout(() => {
              this.showDataModal = true;
              this.cdr.markForCheck();
            }, 100);
          }, 2000);
        }

        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error en chat:', error);
        this.isLoading = false;

        const errorMsg: Message = {
          sender: 'Maestra Emma',
          content:
            '🌟 Disculpa, las configuraciones celestiales están temporalmente perturbadas. Por favor, intenta de nuevo en unos momentos.',
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  private generateAstrologicalResponse(
    userMessage: string
  ): Observable<string> {
    const conversationHistory = this.messages
      .filter((msg) => msg.content && msg.content.trim() !== '')
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    const request: BirthChartRequest = {
      chartData: {
        name: this.astrologerInfo.name,
        specialty: this.astrologerInfo.specialty,
        experience:
          'Siglos de experiencia interpretando configuraciones celestiales y secretos de las cartas natales',
      },
      userMessage,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
      fullName: this.fullName,
      conversationHistory,
    };

    return this.tablaNacimientoService.chatWithAstrologer(request).pipe(
      map((response: BirthChartResponse) => {
        if (response.success && response.response) {
          return response.response;
        } else {
          throw new Error(response.error || 'Error desconocido del servicio');
        }
      }),
      catchError((error: any) => {
        return of(
          '🌟 Las configuraciones celestiales están temporalmente nubladas. Las estrellas me susurran que debo recargar mis energías cósmicas. Por favor, intenta de nuevo en unos momentos.'
        );
      })
    );
  }

  // ========== MÉTODOS DE GUARDADO Y SESIÓN ==========

  private saveStateBeforePayment(): void {
    console.log('💾 Guardando estado antes del pago...');

    this.saveMessagesToSession();
    this.saveChartData();

    sessionStorage.setItem(
      'birthChartUserMessageCount',
      this.userMessageCount.toString()
    );

    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'birthChartBlockedMessageId',
        this.blockedMessageId
      );
    }

    // Guardar datos para MercadoPago
    const paymentData = {
      conversationHistory: this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      })),
      userMessageCount: this.userMessageCount,
      userData: this.userData,
      blockedMessageId: this.blockedMessageId,
      chartData: {
        fullName: this.fullName,
        birthDate: this.birthDate,
        birthTime: this.birthTime,
        birthPlace: this.birthPlace,
        ...this.chartData,
      },
      timestamp: new Date().toISOString(),
    };

    this.mercadopagoService.savePaymentData(paymentData);
    console.log('✅ Estado guardado para recuperar después del pago');
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem(
        'birthChartMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private saveChartData(): void {
    try {
      const dataToSave = {
        ...this.chartData,
        fullName: this.fullName,
        birthDate: this.birthDate,
        birthTime: this.birthTime,
        birthPlace: this.birthPlace,
      };
      sessionStorage.setItem('birthChartData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error guardando datos de carta:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('birthChartMessages');
    sessionStorage.removeItem('birthChartUserMessageCount');
    sessionStorage.removeItem('birthChartBlockedMessageId');
    sessionStorage.removeItem('birthChartData');
  }

  isMessageBlocked(message: Message): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForBirthTable
    );
  }

  // ========== MÉTODOS DE PAGO (MERCADOPAGO) ==========

  onUserDataSubmitted(userData: any): void {
    console.log('📋 Datos del usuario recibidos:', userData);

    // Guardar datos
    this.userData = userData;
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // El modal ya maneja la redirección a MercadoPago
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  // ========== MÉTODOS DE DATOS PERSONALES ==========

  savePersonalData(): void {
    this.chartData = {
      ...this.chartData,
      fullName: this.fullName,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
    };

    if (this.birthDate) {
      this.generateSampleChartData();
    }

    this.saveChartData();
    this.showDataForm = false;

    this.shouldScrollToBottom = true;
    this.addMessage({
      sender: 'Maestra Emma',
      content: `🌟 Perfecto, ${this.fullName}. He registrado tus datos celestiales. Las configuraciones de tu nacimiento en ${this.birthPlace} el ${this.birthDate} revelan patrones únicos en el cosmos. ¿En qué aspecto específico de tu carta natal quieres concentrarte?`,
      timestamp: new Date(),
      isUser: false,
    });
  }

  private generateSampleChartData(): void {
    const date = new Date(this.birthDate);
    const month = date.getMonth() + 1;

    const zodiacSigns = [
      'Capricornio',
      'Acuario',
      'Piscis',
      'Aries',
      'Tauro',
      'Géminis',
      'Cáncer',
      'Leo',
      'Virgo',
      'Libra',
      'Escorpio',
      'Sagitario',
    ];
    const signIndex = Math.floor((month - 1) / 1) % 12;
    this.chartData.sunSign = zodiacSigns[signIndex];
    this.chartData.moonSign = zodiacSigns[(signIndex + 4) % 12];
    this.chartData.ascendant = zodiacSigns[(signIndex + 8) % 12];
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  addMessage(message: Message): void {
    this.messages.push(message);
    this.shouldScrollToBottom = true;
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    formattedContent = formattedContent.replace(/\n/g, '<br>');

    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;
    this.isUserScrolling = !isAtBottom;
    if (isAtBottom) this.isUserScrolling = false;
  }

  onUserStartScroll(): void {
    this.isUserScrolling = true;
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) this.isUserScrolling = false;
      }
    }, 3000);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  clearChat(): void {
    this.messages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;

    this.userMessageCount = 0;
    this.blockedMessageId = null;
    this.isLoading = false;

    this.clearSessionData();

    this.shouldScrollToBottom = true;
    this.initializeBirthChartWelcomeMessage();
    this.cdr.markForCheck();
  }
}

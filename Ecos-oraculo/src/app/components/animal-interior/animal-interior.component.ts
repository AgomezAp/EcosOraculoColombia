import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AnimalChatRequest,
  AnimalGuideData,
  AnimalInteriorService,
} from '../../services/animal-interior.service';
import { MercadopagoService } from '../../services/mercadopago.service';
import { HttpClient } from '@angular/common/http';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
interface Message {
  role: 'user' | 'guide';
  content: string;
  timestamp: Date;
}

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}

@Component({
  selector: 'app-animal-interior',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './animal-interior.component.html',
  styleUrl: './animal-interior.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimalInteriorComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('backgroundVideo') backgroundVideo!: ElementRef<HTMLVideoElement>;

  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  animalServiceConfig: ServiceConfig = {
    serviceId: '6', // ID del servicio animal-interior en el backend
    serviceName: 'Animal Interior - Guía Espiritual',
    amount: 15000, // $15,000 COP
    description:
      'Acceso completo a consultas ilimitadas con Xamán Kiara sobre tu animal interior',
  };

  // Propiedades para controlar el scroll
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Datos del guía
  private guideData: AnimalGuideData = {
    name: 'Chamana Olivia',
    specialty: 'Guía de los Animales Internos',
    experience: 'Especialista en conexión espiritual con el reino animal',
  };

  // Propiedades para la ruleta
  showFortuneWheel: boolean = false;
  animalPrizes: Prize[] = [
    {
      id: '1',
      name: '3 giros de la Rueda Animal',
      color: '#4ecdc4',
      icon: '🦉',
    },
    {
      id: '2',
      name: '1 Guía Premium de Animales',
      color: '#45b7d1',
      icon: '🦋',
    },
    {
      id: '4',
      name: '¡Intenta de nuevo!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;

  // ✅ MercadoPago (reemplaza Stripe/PayPal)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAnimal: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ NUEVO: Contador de mensajes del usuario para lógica del 3er mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 3; // Mostrar modal al 3er mensaje

  private backendUrl = environment.apiUrl;

  constructor(
    private animalService: AnimalInteriorService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {}

  ngAfterViewInit(): void {
    if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
      this.backgroundVideo.nativeElement.playbackRate = 0.6;
    }
  }

  async ngOnInit(): Promise<void> {
    console.log('🦉 ====== INICIANDO ANIMAL INTERIOR ======');

    // ✅ PASO 1: Verificar si ya está pagado (desde sessionStorage)
    this.hasUserPaidForAnimal =
      sessionStorage.getItem('hasUserPaidForAnimal_inneresTier') === 'true' ||
      this.mercadopagoService.isServicePaid('6');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForAnimal);

    // ✅ PASO 2: Verificar si viene de MercadoPago (tiene parámetros en URL)
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // ✅ GUARDAR ESTADO DE PAGO
        this.hasUserPaidForAnimal = true;
        sessionStorage.setItem('hasUserPaidForAnimal_inneresTier', 'true');
        this.mercadopagoService.saveServicePaymentStatus('6', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('animalInteriorBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (savedData.chatMessages && savedData.chatMessages.length > 0) {
            this.chatMessages = savedData.chatMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            console.log('💬 Mensajes recuperados:', this.chatMessages.length);
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
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        this.addMessage({
          sender: this.guideData.name,
          content: `✨ **¡Pago confirmado exitosamente!** ✨

🦉 Ahora tienes acceso completo e ilimitado a mi sabiduría sobre el reino animal. 

Los espíritus animales te dan la bienvenida. Puedes preguntarme lo que desees sobre tu animal interior, conexiones espirituales y todos los misterios ancestrales.

¿En qué puedo ayudarte?`,
          timestamp: new Date(),
          isUser: false,
        });

        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem('pendingAnimalMessage');
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingAnimalMessage');
          setTimeout(() => {
            this.processUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return; // Salir aquí, ya procesamos todo
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        this.addMessage({
          sender: this.guideData.name,
          content:
            '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
          isUser: false,
        });
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

    // ✅ PASO 4: Cargar mensajes guardados (si no vienen del pago)
    if (this.chatMessages.length === 0) {
      const savedMessages = sessionStorage.getItem('animalInteriorMessages');
      const savedMessageCount = sessionStorage.getItem(
        'animalInteriorUserMessageCount'
      );
      const savedBlockedMessageId = sessionStorage.getItem(
        'animalInteriorBlockedMessageId'
      );

      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          this.chatMessages = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          this.userMessageCount = parseInt(savedMessageCount || '0');
          this.blockedMessageId = savedBlockedMessageId || null;
          this.lastMessageCount = this.chatMessages.length;
        } catch (error) {
          console.error('Error parseando mensajes:', error);
          this.initializeWelcomeMessage();
        }
      } else {
        this.initializeWelcomeMessage();
      }
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForAnimal && this.blockedMessageId) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('animalInteriorBlockedMessageId');
    }

    // Mostrar ruleta si aplica
    if (this.chatMessages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(2000);
    }

    this.cdr.markForCheck();
  }

  private cleanUrlParams(): void {
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
    }
  }

  private initializeWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('animalInteriorUserMessageCount', '0');

    this.addMessage({
      sender: 'Chamana Olivia',
      content: `🦉 ¡Hola, Buscador! Soy Olivia, tu guía espiritual del reino animal. Estoy aquí para ayudarte a descubrir tu animal interior y conectar con él.

¿Qué te gustaría explorar sobre tu espíritu animal?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    }
  }

  ngAfterViewChecked(): void {
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.chatMessages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.chatMessages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForAnimal) {
      this.shouldScrollToBottom = true;
      this.processUserMessage(userMessage);
      return;
    }

    // ✅ Verificar consultas gratis
    if (this.hasFreeAnimalConsultationsAvailable()) {
      this.useFreeAnimalConsultation();
      this.shouldScrollToBottom = true;
      this.processUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 3er mensaje o posterior
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      // Cerrar otros modales
      this.showFortuneWheel = false;
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingAnimalMessage', userMessage);

      // Guardar estado antes del pago
      this.saveStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // Procesar mensaje normalmente (mensajes 1 y 2)
    this.shouldScrollToBottom = true;
    this.processUserMessage(userMessage);
  }

  private processUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem(
      'animalInteriorUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    this.addMessage({
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    });

    this.currentMessage = '';
    this.isLoading = true;

    const conversationHistory = this.chatMessages.slice(-10).map((msg) => ({
      role: msg.isUser ? ('user' as const) : ('guide' as const),
      message: msg.content,
    }));

    const chatRequest: AnimalChatRequest = {
      guideData: this.guideData,
      userMessage: userMessage,
      conversationHistory: conversationHistory,
    };

    this.animalService.chatWithGuide(chatRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;

        if (response.success && response.response) {
          const messageId = Date.now().toString();
          this.addMessage({
            sender: 'Chamana Olivia',
            content: response.response,
            timestamp: new Date(),
            isUser: false,
            id: messageId,
          });

          // ✅ Verificar si debe bloquear después del 3er mensaje
          if (
            !this.hasUserPaidForAnimal &&
            !this.hasFreeAnimalConsultationsAvailable() &&
            this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
          ) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('animalInteriorBlockedMessageId', messageId);

            // Mostrar modal de pago después de 2 segundos
            setTimeout(() => {
              this.saveStateBeforePayment();
              this.showFortuneWheel = false;
              this.showPaymentModal = false;

              setTimeout(() => {
                this.showDataModal = true;
                this.cdr.markForCheck();
              }, 100);
            }, 2000);
          }
        } else {
          this.addMessage({
            sender: 'Chamana Olivia',
            content:
              '🦉 Lo siento, no pude conectarme con la sabiduría animal en este momento. Inténtalo de nuevo.',
            timestamp: new Date(),
            isUser: false,
          });
        }
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error en chat:', error);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
        this.addMessage({
          sender: 'Chamana Olivia',
          content:
            '🦉 Hubo un error en la conexión espiritual. Inténtalo de nuevo.',
          timestamp: new Date(),
          isUser: false,
        });
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();

    // Guardar contador
    sessionStorage.setItem(
      'animalInteriorUserMessageCount',
      this.userMessageCount.toString()
    );

    // Guardar mensaje bloqueado si existe
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'animalInteriorBlockedMessageId',
        this.blockedMessageId
      );
    }

    // ✅ IMPORTANTE: Guardar datos para MercadoPago
    const paymentData = {
      chatMessages: this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      })),
      userMessageCount: this.userMessageCount,
      userData: this.userData,
      blockedMessageId: this.blockedMessageId,
      timestamp: new Date().toISOString(),
    };

    this.mercadopagoService.savePaymentData(paymentData);
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem(
        'animalInteriorMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForAnimal;
  }

  // ✅ MÉTODO ACTUALIZADO PARA MERCADOPAGO
  async promptForPayment(): Promise<void> {
    this.showPaymentModal = true;
    this.paymentError = null;
    this.isProcessingPayment = false;
    this.cdr.markForCheck();

    // Validar datos de usuario
    if (!this.userData) {
      const savedUserData = sessionStorage.getItem('userData');
      if (savedUserData) {
        try {
          this.userData = JSON.parse(savedUserData);
        } catch (error) {
          this.userData = null;
        }
      }
    }

    if (!this.userData || !this.userData.email) {
      this.paymentError =
        'No se encontraron datos del cliente. Por favor, complete el formulario primero.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }
  }

  // ✅ MÉTODO ACTUALIZADO PARA MERCADOPAGO
  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // Guardar datos antes de redirigir a MercadoPago
      const paymentData = {
        chatMessages: this.chatMessages.map((msg) => ({
          ...msg,
          timestamp:
            msg.timestamp instanceof Date
              ? msg.timestamp.toISOString()
              : msg.timestamp,
        })),
        userMessageCount: this.userMessageCount,
        userData: this.userData,
        blockedMessageId: this.blockedMessageId,
        timestamp: new Date().toISOString(),
      };

      this.mercadopagoService.savePaymentData(paymentData);

      // Crear orden de MercadoPago
      const order = await this.mercadopagoService.createOrder({
        amount: 15000, // $15,000 COP
        serviceName: 'Animal Interior - Guía Espiritual',
        serviceId: '6', // ID del servicio animal-interior
        firstName: this.userData.firstName || 'Usuario',
        lastName: this.userData.lastName || 'Ecos',
        email: this.userData.email,
        categoryId: 'services',
        description:
          'Acceso completo a consultas ilimitadas con Xamán Kiara sobre tu animal interior',
      });

      console.log('✅ Orden de MercadoPago creada:', order);

      // Redirigir a MercadoPago
      const paymentUrl = order.sandbox_init_point || order.init_point;
      this.mercadopagoService.redirectToPayment(paymentUrl);
    } catch (error: any) {
      console.error('❌ Error al crear orden de MercadoPago:', error);
      this.paymentError =
        error.message || 'Error al inicializar el pago. Intenta nuevamente.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  addMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
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

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;
    this.isUserScrolling = !isAtBottom;
    if (isAtBottom) {
      this.isUserScrolling = false;
    }
  }

  onUserStartScroll(): void {
    this.isUserScrolling = true;
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) {
          this.isUserScrolling = false;
        }
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

  clearChat(): void {
    this.chatMessages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;
    this.userMessageCount = 0;
    this.blockedMessageId = null;
    this.isLoading = false;

    sessionStorage.removeItem('animalInteriorMessages');
    sessionStorage.removeItem('animalInteriorUserMessageCount');
    sessionStorage.removeItem('animalInteriorBlockedMessageId');

    this.shouldScrollToBottom = true;

    this.addMessage({
      sender: 'Chamana Olivia',
      content: `🦉 ¡Hola, Buscador! Soy Olivia, tu guía espiritual del reino animal. Estoy aquí para ayudarte a descubrir tu animal interior y conectar con él.

¿Qué te gustaría explorar sobre tu espíritu animal?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    }
  }

  // ✅ MÉTODO ACTUALIZADO PARA MERCADOPAGO
  onUserDataSubmitted(userData: any): void {
    console.log('📋 Datos del usuario recibidos:', userData);

    // Guardar datos
    this.userData = userData;
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // El modal ya maneja la redirección a MercadoPago
    // Solo cerramos el modal si no hay pago
    this.showDataModal = false;
    this.cdr.markForCheck();
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  // ========== MÉTODOS DE LA RULETA ==========

  showAnimalWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      sender: 'Chamana Olivia',
      content: `🦉 ¡Los espíritus animales han hablado! Has ganado: **${prize.name}** ${prize.icon}\n\nLos antiguos guardianes del reino animal han decidido bendecirte con este regalo sagrado.`,
      timestamp: new Date(),
      isUser: false,
    };

    this.chatMessages.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveMessagesToSession();
    this.processAnimalPrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerAnimalWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'No tienes giros disponibles. ' + FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processAnimalPrize(prize: Prize): void {
    switch (prize.id) {
      case '1':
        this.addFreeAnimalConsultations(3);
        break;
      case '2':
        this.hasUserPaidForAnimal = true;
        sessionStorage.setItem('hasUserPaidForAnimal_inneresTier', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('animalInteriorBlockedMessageId');
        }

        const premiumMessage: ChatMessage = {
          sender: 'Chamana Olivia',
          content:
            '🦋 **¡Has desbloqueado el acceso Premium completo!** 🦋\n\nAhora tienes acceso ilimitado a toda la sabiduría del reino animal.',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      case '4':
        break;
      default:
    }
  }

  private addFreeAnimalConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeAnimalConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForAnimal) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('animalInteriorBlockedMessageId');
    }
  }

  private hasFreeAnimalConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAnimalConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAnimalConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeAnimalConsultations', remaining.toString());

      const prizeMsg: ChatMessage = {
        sender: 'Chamana Olivia',
        content: `✨ *Has utilizado una conexión espiritual gratuita* ✨\n\nTe quedan **${remaining}** consultas gratuitas disponibles.`,
        timestamp: new Date(),
        isUser: false,
      };
      this.chatMessages.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveMessagesToSession();
    }
  }

  debugAnimalWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck();
  }
}

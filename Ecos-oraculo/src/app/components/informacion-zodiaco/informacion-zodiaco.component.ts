import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InformacionZodiacoService } from '../../services/informacion-zodiaco.service';
import { MercadopagoService } from '../../services/mercadopago.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface ZodiacMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender: string;
  id?: string;
}

interface AstrologerData {
  name: string;
  title: string;
  specialty: string;
  experience: string;
}

interface ZodiacRequest {
  zodiacData: AstrologerData;
  userMessage: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
}

interface ZodiacResponse {
  success: boolean;
  response?: string;
  error?: string;
  timestamp: string;
}

@Component({
  selector: 'app-informacion-zodiaco',
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
  templateUrl: './informacion-zodiaco.component.html',
  styleUrl: './informacion-zodiaco.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformacionZodiacoComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  currentMessage: string = '';
  messages: any[] = [];
  isLoading = false;
  hasStartedConversation = false;

  // Variables de control de scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  zodiacoServiceConfig: ServiceConfig = {
    serviceId: '3', // ID del servicio Informacion-zodiaco en el backend
    serviceName: 'Información del Zodiaco',
    amount: 10000, // $10,000 COP
    description:
      'Acceso completo a consultas ilimitadas sobre astrología y signos zodiacales',
  };

  // ✅ Variables para control de pagos (MercadoPago)
  hasUserPaidForAstrology: boolean = false;
  blockedMessageId: string | null = null;
  paymentError: string | null = null;

  // ✅ Contador de mensajes del usuario para lógica del 3er mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 3;

  // Configuración de la rueda de la fortuna
  showFortuneWheel: boolean = false;
  astralPrizes: Prize[] = [
    {
      id: '1',
      name: '3 lanzamientos de la Rueda Astral',
      color: '#4ecdc4',
      icon: '🔮',
    },
    { id: '2', name: '1 Lectura Premium Astral', color: '#45b7d1', icon: '✨' },
    {
      id: '4',
      name: '¡Intenta de nuevo!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;

  private backendUrl = environment.apiUrl;

  astrologerInfo = {
    name: 'Maestra Carla',
    title: 'Guardiana de las Estrellas',
    specialty: 'Especialista en Astrología y Signos del Zodiaco',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Bienvenido, alma cósmica. Las estrellas me susurraron tu llegada... ¿Qué secretos del zodiaco quieres descifrar hoy?',
    'Los planetas se alinean para recibirte. Soy la Maestra Carla, intérprete de los destinos celestiales. ¿Sobre qué quieres consultar respecto a tu signo zodiacal o aspecto celestial?',
    'El universo vibra con tu presencia... Las constelaciones danzan y esperan tus preguntas. Permíteme guiarte a través de los caminos del zodiaco.',
    'Ah, veo que las estrellas te han guiado hacia mí. Los secretos de los signos del zodiaco aguardan ser revelados. ¿Qué te inquieta en el firmamento?',
  ];

  constructor(
    private http: HttpClient,
    private zodiacoService: InformacionZodiacoService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<InformacionZodiacoComponent>,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('🌟 ====== INICIANDO INFORMACIÓN ZODÍACO ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForAstrology =
      sessionStorage.getItem('hasUserPaidForZodiacInfo_zodiacInfo') ===
        'true' || this.mercadopagoService.isServicePaid('3');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForAstrology);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();
      console.log('📊 Payment Status:', paymentStatus);

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');

        // Guardar estado de pago PRIMERO
        this.hasUserPaidForAstrology = true;
        sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');
        this.mercadopagoService.saveServicePaymentStatus('3', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('blockedAstrologyMessageId');

        // ✅ IMPORTANTE: Recuperar datos de AMBAS fuentes (MercadoPago y sessionStorage)
        let messagesRecovered = false;

        // Primero intentar recuperar de MercadoPago (datos guardados antes del pago)
        const savedPaymentData = this.mercadopagoService.getPaymentData();
        console.log('📦 Datos de MercadoPago:', savedPaymentData);

        if (
          savedPaymentData &&
          savedPaymentData.messages &&
          savedPaymentData.messages.length > 0
        ) {
          console.log('✅ Recuperando mensajes de MercadoPago...');
          this.messages = savedPaymentData.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          this.userMessageCount = savedPaymentData.userMessageCount || 0;
          this.hasStartedConversation = true;
          messagesRecovered = true;
          console.log(
            '💬 Mensajes recuperados de MercadoPago:',
            this.messages.length
          );
        }

        // Si no hay mensajes de MercadoPago, intentar de sessionStorage
        if (!messagesRecovered) {
          const savedSessionMessages =
            sessionStorage.getItem('astrologyMessages');
          console.log(
            '📦 Datos de sessionStorage:',
            savedSessionMessages ? 'Encontrados' : 'No encontrados'
          );

          if (savedSessionMessages) {
            try {
              const parsedMessages = JSON.parse(savedSessionMessages);
              this.messages = parsedMessages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              }));
              this.userMessageCount = parseInt(
                sessionStorage.getItem('astrologyUserMessageCount') || '0'
              );
              this.hasStartedConversation = true;
              messagesRecovered = true;
              console.log(
                '💬 Mensajes recuperados de sessionStorage:',
                this.messages.length
              );
            } catch (error) {
              console.error(
                'Error parseando mensajes de sessionStorage:',
                error
              );
            }
          }
        }

        // Recuperar datos de usuario
        if (savedPaymentData?.userData) {
          this.userData = savedPaymentData.userData;
          sessionStorage.setItem(
            'userData',
            JSON.stringify(savedPaymentData.userData)
          );
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        const successMessage = {
          isUser: false,
          content: `✨ **¡Pago confirmado exitosamente!** ✨

🌟 Ahora tienes acceso completo e ilimitado a mi sabiduría sobre los astros y el zodiaco.

Las estrellas te dan la bienvenida. Puedes preguntarme lo que desees sobre tu signo zodiacal, compatibilidades, predicciones astrológicas y todos los misterios celestiales.

¿Qué secreto de las estrellas deseas descubrir?`,
          timestamp: new Date(),
        };
        this.messages.push(successMessage);

        // ✅ GUARDAR los mensajes recuperados + mensaje de confirmación
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem(
          'pendingAstrologyMessage'
        );
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingAstrologyMessage');
          setTimeout(() => {
            this.processUserMessage(pendingMessage);
          }, 2000);
        }

        this.lastMessageCount = this.messages.length;
        this.cdr.markForCheck();

        console.log('🌟 ====== PAGO PROCESADO COMPLETAMENTE ======');
        console.log('  - Mensajes totales:', this.messages.length);
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        // Cargar mensajes existentes primero
        this.loadAstrologyData();

        const pendingMessage = {
          isUser: false,
          content:
            '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
        };
        this.messages.push(pendingMessage);
        this.saveMessagesToSession();
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      } else if (
        paymentStatus.status === 'rejected' ||
        paymentStatus.status === 'failure'
      ) {
        console.log('❌ Pago rechazado o fallido');
        // Cargar mensajes existentes
        this.loadAstrologyData();

        this.paymentError =
          'El pago no se pudo completar. Por favor, intenta nuevamente.';

        const errorMessage = {
          isUser: false,
          content:
            '❌ El pago no se pudo completar. Por favor, intenta nuevamente.',
          timestamp: new Date(),
        };
        this.messages.push(errorMessage);
        this.saveMessagesToSession();
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      }
    } else {
      // ✅ PASO 3: No viene de pago - Cargar datos normalmente
      const savedUserData = sessionStorage.getItem('userData');
      if (savedUserData) {
        try {
          this.userData = JSON.parse(savedUserData);
        } catch (error) {
          this.userData = null;
        }
      }

      // Cargar mensajes guardados
      this.loadAstrologyData();
    }

    // ✅ PASO 4: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForAstrology && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('blockedAstrologyMessageId');
    }

    // Mostrar ruleta si aplica
    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }

    console.log('🌟 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForAstrology);
    console.log('  - Mensajes:', this.messages.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadAstrologyData(): void {
    const savedMessages = sessionStorage.getItem('astrologyMessages');
    const savedMessageCount = sessionStorage.getItem(
      'astrologyUserMessageCount'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'blockedAstrologyMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
        this.lastMessageCount = this.messages.length;
        console.log('💬 Mensajes cargados de sesión:', this.messages.length);
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  // ========== MÉTODOS DE ENVÍO DE MENSAJES ==========

  sendMessage(): void {
    if (!this.currentMessage?.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForAstrology);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForAstrology) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage);
      return;
    }

    // ✅ Verificar consultas gratis
    if (this.hasFreeAstrologyConsultationsAvailable()) {
      console.log('🎁 Usando consulta gratuita');
      this.useFreeAstrologyConsultation();
      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 3er mensaje o posterior
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showFortuneWheel = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingAstrologyMessage', userMessage);

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
    this.shouldAutoScroll = true;
    this.processUserMessage(userMessage);
  }

  private processUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem(
      'astrologyUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    const userMsg = {
      isUser: true,
      content: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;

    this.generateAstrologyResponse(userMessage).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.shouldAutoScroll = true;

        const messageId = Date.now().toString();
        const astrologerMsg = {
          isUser: false,
          content: response,
          timestamp: new Date(),
          id: messageId,
        };
        this.messages.push(astrologerMsg);

        // ✅ Verificar si debe bloquear después del 3er mensaje
        if (
          !this.hasUserPaidForAstrology &&
          !this.hasFreeAstrologyConsultationsAvailable() &&
          this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
        ) {
          this.blockedMessageId = messageId;
          sessionStorage.setItem('blockedAstrologyMessageId', messageId);

          // Mostrar modal de pago después de 2 segundos
          setTimeout(() => {
            this.saveStateBeforePayment();
            this.showFortuneWheel = false;

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

        const errorMsg = {
          isUser: false,
          content:
            '🌟 Disculpa, las energías cósmicas están temporalmente perturbadas. Por favor, intenta de nuevo en unos momentos.',
          timestamp: new Date(),
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  private generateAstrologyResponse(userMessage: string): Observable<string> {
    const conversationHistory = this.messages
      .filter((msg) => msg.content && msg.content.trim() !== '')
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    const astrologerData: AstrologerData = {
      name: this.astrologerInfo.name,
      title: this.astrologerInfo.title,
      specialty: this.astrologerInfo.specialty,
      experience:
        'Siglos de experiencia en la interpretación de destinos celestiales',
    };

    const request: ZodiacRequest = {
      zodiacData: astrologerData,
      userMessage,
      conversationHistory,
    };

    return this.zodiacoService.chatWithAstrologer(request).pipe(
      map((response: ZodiacResponse) => {
        if (response.success && response.response) {
          return response.response;
        } else {
          throw new Error(response.error || 'Error desconocido del servicio');
        }
      }),
      catchError((error: any) => {
        return of(
          '🌟 Las estrellas están temporalmente nubladas. Por favor, intenta de nuevo en unos momentos.'
        );
      })
    );
  }

  // ========== MÉTODOS DE GUARDADO Y SESIÓN ==========

  private saveStateBeforePayment(): void {
    console.log('💾 ====== GUARDANDO ESTADO ANTES DEL PAGO ======');

    // ✅ PASO 1: Guardar en sessionStorage (backup)
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'astrologyUserMessageCount',
      this.userMessageCount.toString()
    );

    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'blockedAstrologyMessageId',
        this.blockedMessageId
      );
    }

    // ✅ PASO 2: Preparar datos para MercadoPago
    const messagesToSave = this.messages.map((msg) => ({
      ...msg,
      timestamp:
        msg.timestamp instanceof Date
          ? msg.timestamp.toISOString()
          : msg.timestamp,
    }));

    const paymentData = {
      messages: messagesToSave,
      userMessageCount: this.userMessageCount,
      userData: this.userData,
      blockedMessageId: this.blockedMessageId,
      serviceId: '3',
      serviceName: 'Información del Zodiaco',
      timestamp: new Date().toISOString(),
    };

    console.log('📦 Datos a guardar:', {
      mensajes: messagesToSave.length,
      contador: this.userMessageCount,
      bloqueado: this.blockedMessageId,
    });

    // ✅ PASO 3: Guardar en MercadoPago service (localStorage)
    this.mercadopagoService.savePaymentData(paymentData);

    // ✅ PASO 4: Verificar que se guardó correctamente
    const verificacion = this.mercadopagoService.getPaymentData();
    console.log('✅ Verificación de guardado:', verificacion ? 'OK' : 'ERROR');
    console.log('💾 ====== ESTADO GUARDADO ======');
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
        'astrologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('astrologyMessages');
    sessionStorage.removeItem('astrologyUserMessageCount');
    sessionStorage.removeItem('blockedAstrologyMessageId');
  }

  isMessageBlocked(message: any): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForAstrology
    );
  }

  // ========== MÉTODOS DE DATOS Y PAGO ==========

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

  // ========== MÉTODOS DE LA RULETA ==========

  showWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (FortuneWheelComponent.canShowWheel() && !this.showDataModal) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage = {
      isUser: false,
      content: `🌟 ¡Las energías cósmicas te han bendecido! Has ganado: **${prize.name}** ${prize.icon}\n\nEste regalo del universo ha sido activado para ti. Los secretos del zodiaco te serán revelados con mayor claridad.`,
      timestamp: new Date(),
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
    this.processAstralPrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerFortuneWheel(): void {
    if (this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'No tienes lanzamientos disponibles. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processAstralPrize(prize: Prize): void {
    switch (prize.id) {
      case '1':
        this.addFreeAstrologyConsultations(3);
        break;
      case '2':
        this.hasUserPaidForAstrology = true;
        sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');
        this.mercadopagoService.saveServicePaymentStatus('3', true);

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('blockedAstrologyMessageId');
        }

        const premiumMessage = {
          isUser: false,
          content:
            '✨ **¡Has desbloqueado el acceso Premium completo!** ✨\n\nAhora tienes acceso ilimitado a todo el conocimiento astral.',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      case '4':
        break;
      default:
    }
  }

  private addFreeAstrologyConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeAstrologyConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForAstrology) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('blockedAstrologyMessageId');
    }
  }

  private hasFreeAstrologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAstrologyConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeAstrologyConsultations',
        remaining.toString()
      );

      const prizeMsg = {
        isUser: false,
        content: `✨ *Has utilizado una consulta astral gratuita* ✨\n\nTe quedan **${remaining}** consultas astrales gratuitas.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  // ========== MÉTODOS DE UI ==========

  startConversation(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('astrologyUserMessageCount', '0');

    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage = {
        isUser: false,
        content: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    }
  }

  clearConversation(): void {
    this.messages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;
    this.userMessageCount = 0;
    this.blockedMessageId = null;
    this.isLoading = false;
    this.hasStartedConversation = false;

    this.clearSessionData();

    this.shouldAutoScroll = true;
    this.startConversation();
    this.cdr.markForCheck();
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
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

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
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
}

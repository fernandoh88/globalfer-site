import { Building2, Hammer, MessageCircle, Ruler, Truck, Wrench } from 'lucide-react'

export const services = [
  {
    title: 'Corte e dobra de aço',
    description: 'Preparação de vergalhões conforme as dimensões solicitadas para cada etapa da obra.',
    icon: Wrench,
  },
  {
    title: 'Montagem de ferragem armada',
    description: 'Peças montadas com organização para colunas, vigas, sapatas, baldrames e reforços.',
    icon: Hammer,
  },
  {
    title: 'Produção sob medida',
    description: 'Atendimento flexível para medidas, quantidades e formatos definidos pelo cliente.',
    icon: Ruler,
  },
  {
    title: 'Obras residenciais e comerciais',
    description: 'Soluções para pequenas reformas, casas, galpões, lojas, empreendimentos e construtoras.',
    icon: Building2,
  },
  {
    title: 'Entrega conforme localidade',
    description: 'Organização de retirada ou entrega de acordo com disponibilidade, volume e região.',
    icon: Truck,
  },
  {
    title: 'Pedidos por WhatsApp',
    description: 'Atendimento direto para tirar dúvidas, enviar medidas e agilizar solicitações.',
    icon: MessageCircle,
    href: '#contato',
  },
]

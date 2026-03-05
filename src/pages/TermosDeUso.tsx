import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 safe-area">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Button>

        <h1 className="text-2xl sm:text-3xl font-black mb-6 uppercase">
          Termo de Uso - Provador Virtual
        </h1>

        <div className="glass-card p-6 rounded-2xl space-y-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Objeto</h2>
            <p>
              Este Termo regula o uso da funcionalidade de "Virtual Try-On" (prova virtual de camisas), 
              disponibilizada pela Virtual Fans em parceria com o clube, que permite aos usuários 
              visualizar como ficariam vestindo as camisas oficiais do clube por meio de inteligência artificial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Direito de Imagem</h2>
            <p>
              Ao utilizar esta funcionalidade, o usuário declara ser o titular dos direitos da imagem 
              enviada ou possuir autorização expressa de todas as pessoas que nela aparecem para o uso 
              nesta plataforma. O usuário assume total responsabilidade civil e criminal por qualquer 
              violação de direitos de imagem de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Conteúdo Proibido</h2>
            <p>É expressamente vedado o envio de imagens que contenham:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Nudez ou conteúdo sexual</li>
              <li>Violência ou incitação ao ódio</li>
              <li>Conteúdo ilegal ou ofensivo</li>
              <li>Menores de idade sem autorização dos responsáveis legais</li>
              <li>Qualquer conteúdo que viole a legislação brasileira</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Uso da Marca</h2>
            <p>
              As camisas e marcas exibidas são de propriedade exclusiva do clube. O uso da imagem 
              gerada é estritamente pessoal e não comercial. É proibida a reprodução, distribuição 
              ou comercialização das imagens geradas sem autorização expressa do clube.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Isenção de Responsabilidade</h2>
            <p>
              A Virtual Fans e o clube não se responsabilizam por:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Uso indevido das imagens geradas pelos usuários</li>
              <li>Violações de direitos de imagem de terceiros</li>
              <li>Conteúdo impróprio enviado pelos usuários</li>
              <li>Danos diretos ou indiretos decorrentes do uso da funcionalidade</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Privacidade e LGPD</h2>
            <p>
              As imagens enviadas são processadas exclusivamente para geração do resultado virtual 
              e não são armazenadas permanentemente em nossos servidores. O tratamento de dados 
              segue as diretrizes da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Registro de Consentimento</h2>
            <p>
              Ao marcar a caixa de aceite, o usuário consente expressamente com estes termos. 
              Este consentimento é registrado com data, hora, identificador do usuário e endereço IP 
              para fins de comprovação legal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Disposições Gerais</h2>
            <p>
              Este Termo pode ser atualizado a qualquer momento. O uso continuado da funcionalidade 
              após alterações implica aceitação das novas condições. Em caso de dúvidas, entre em 
              contato através dos canais oficiais do clube ou da Virtual Fans.
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-white/10">
            Última atualização: Fevereiro de 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;

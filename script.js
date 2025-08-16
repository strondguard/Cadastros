    const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz7RrNBg1sTW5M4U5t-bYQk1djVdu7ZIdQI4iSwpIID0PVG719O0WfiFhNtFJ5ym4Vb3A/exec'; // URL para POST (salvar) e GET (configurações)

    // Mapeamento dos campos do formulário para as configurações
    const formFields = [
        { id: 'numPessoas', label: 'Quantidade de Pessoas', type: 'select' },
        { id: 'nomeTitular', label: 'Nome Completo (Titular)', type: 'text' },
        { id: 'dataNascTitular', label: 'Data de Nascimento (Titular)', type: 'text' },
        { id: 'cpfTitular', label: 'CPF (Titular)', type: 'text' },
        { id: 'rgTitular', label: 'RG (Titular)', type: 'text' },
        { id: 'celularTitular', label: 'Celular (Titular)', type: 'text' },
        { id: 'emailTitular', label: 'Email (Titular)', type: 'email' },
        { id: 'placaCarro', label: 'Placa do Carro', type: 'text' },
        { id: 'cep', label: 'CEP', type: 'text' },
        { id: 'numero', label: 'Número', type: 'text' },
        { id: 'rua', label: 'Rua', type: 'text' },
        { id: 'bairro', label: 'Bairro', type: 'text' },
        { id: 'cidade', label: 'Cidade', type: 'text' }
    ];

    let currentFormConfig = {}; // Armazena as configurações de visibilidade/obrigatoriedade
    let cpfMinAge = 9; // Valor padrão para a idade mínima do CPF

    $(document).ready(function() {
        loadFormConfig(); // Carregar configurações para aplicar ao formulário

        // Máscaras
        $('#dataNascTitular').mask('00/00/0000');
        $('#cpfTitular').mask('000.000.000-00');
        $('#celularTitular').mask('(00) 00000-0000');
        $('#cep').mask('00000-000');
        $('#placaCarro').mask('AAA-0A00');

        // Busca de CEP
        $('#cep').on('blur', function() {
            const cep = $(this).val().replace(/\D/g, '');
            if (cep.length === 8) {
                $.getJSON(`https://viacep.com.br/ws/${cep}/json/`, function(data) {
                    if (!data.erro) {
                        $('#rua').val(data.logradouro);
                        $('#bairro').val(data.bairro);
                        $('#cidade').val(data.localidade);
                    }
                });
            }
        });

        // Atualizar acompanhantes
        $('#numPessoas').change(function() {
            const num = parseInt($(this).val());
            const numAcompanhantes = num > 0 ? num - 1 : 0;
            $('#acompanhantes').empty();
            for (let i = 0; i < numAcompanhantes; i++) {
                $('#acompanhantes').append(`
                    <div class="acompanhante">
                        <h3>Acompanhante ${i + 1}</h3>
                        <label for="nomeAcomp_${i}">Nome Completo</label>
                        <input type="text" id="nomeAcomp_${i}" required aria-required="true" aria-label="Nome completo do acompanhante ${i + 1}">
                        <span class="error" id="nomeAcomp_${i}Error">Nome completo é obrigatório</span>
                        <label for="dataNascAcomp_${i}">Data de Nascimento</label>
                        <input type="text" id="dataNascAcomp_${i}" placeholder="DD/MM/AAAA" required aria-required="true" aria-label="Data de nascimento do acompanhante ${i + 1}">
                        <span class="error" id="dataNascAcomp_${i}Error">Data de nascimento inválida</span>
                        <label for="cpfAcomp_${i}">CPF</label>
                        <input type="text" id="cpfAcomp_${i}" aria-label="CPF do acompanhante ${i + 1}">
                        <span class="error" id="cpfAcomp_${i}Error">CPF inválido</span>
                    </div>
                `);
                $(`#dataNascAcomp_${i}`).mask('00/00/0000');
                $(`#cpfAcomp_${i}`).mask('000.000.000-00');

                // Tornar CPF obrigatório com base na data de nascimento e cpfMinAge
                $(`#dataNascAcomp_${i}`).on('blur', function() {
                    const dataNasc = $(this).val();
                    const idade = calcularIdade(dataNasc);
                    if (idade >= cpfMinAge) { // Usa a idade configurada
                        $(`#cpfAcomp_${i}`).prop('required', true).attr('aria-required', 'true');
                        $(`label[for="cpfAcomp_${i}"]`).addClass('required-field');
                    } else {
                        $(`#cpfAcomp_${i}`).prop('required', false).removeAttr('aria-required');
                        $(`label[for="cpfAcomp_${i}"]`).removeClass('required-field');
                    }
                });
            }
        });

        // Validações (Mantenha todas as funções de validação aqui)
        function validarCPF(cpf) {
            cpf = cpf.replace(/\D/g, '');
            if (cpf.length !== 11) return false;
            if (/^(\d)\1{10}$/.test(cpf)) return false;
            let soma = 0, resto;
            for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i-1]) * (11 - i);
            resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            if (resto !== parseInt(cpf[9])) return false;
            soma = 0;
            for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i-1]) * (12 - i);
            resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            if (resto !== parseInt(cpf[10])) return false;
            return true;
        }

        function validarEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        function validarCelular(celular) {
            const re = /^\(\d{2}\)\s\d{5}-\d{4}$/;
            return re.test(celular);
        }

        function validarDataNasc(dataNasc) {
            if (!dataNasc || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataNasc)) return false;
            const [dia, mes, ano] = dataNasc.split('/').map(Number);
            const dataObj = new Date(ano, mes - 1, dia);
            if (dataObj.getFullYear() !== ano || dataObj.getMonth() !== mes - 1 || dataObj.getDate() !== dia) {
                return false;
            }
            const hoje = new Date();
            if (dataObj > hoje || ano < 1900) return false;
            return true;
        }

        function validarCep(cep) {
            const re = /^\d{5}-\d{3}$/;
            return re.test(cep);
        }

        function calcularIdade(dataNasc) {
            if (!dataNasc || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataNasc)) return 0;
            const [dia, mes, ano] = dataNasc.split('/').map(Number);
            const hoje = new Date();
            const nascimento = new Date(ano, mes - 1, dia);
            let idade = hoje.getFullYear() - nascimento.getFullYear();
            const m = hoje.getMonth() - nascimento.getMonth();
            if (m < 0 || (m === 0 && hoje.getDate() < dia)) idade--;
            return idade;
        }

        // Função para carregar configurações do formulário (visibilidade/obrigatoriedade e idade CPF)
        async function loadFormConfig() {
            try {
                const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getFormConfig`);
                const data = await response.json();

                if (data.status === 'success' && data.config) {
                    currentFormConfig = data.config.fieldConfig || {};
                    cpfMinAge = data.config.cpfMinAge || 9; // Carrega a idade configurada
                } else {
                    console.warn("Não foi possível carregar as configurações do formulário. Usando padrões.");
                    // Define padrões se não conseguir carregar
                    formFields.forEach(field => {
                        currentFormConfig[field.id] = {
                            required: (field.id !== 'rgTitular' && field.id !== 'placaCarro' && field.id !== 'numero'),
                            visible: true
                        };
                    });
                    cpfMinAge = 9;
                }
            } catch (error) {
                console.error("Erro ao carregar configurações do formulário:", error);
                // Define padrões em caso de erro na requisição
                formFields.forEach(field => {
                    currentFormConfig[field.id] = {
                        required: (field.id !== 'rgTitular' && field.id !== 'placaCarro' && field.id !== 'numero'),
                        visible: true
                    };
                });
                cpfMinAge = 9;
            }
            updateFormFields(); // Aplica as configurações carregadas
        }

        // Função para aplicar configurações ao formulário
        function updateFormFields() {
            formFields.forEach(field => {
                const inputElement = $(`#${field.id}`);
                const labelElement = $(`#label-${field.id}`);
                const errorElement = $(`#${field.id}Error`);

                const config = currentFormConfig[field.id] || { required: false, visible: true }; // Padrão se não houver config

                let parentContainer = inputElement.parent();

                if (config.visible) {
                    parentContainer.show();
                    labelElement.show();
                    inputElement.prop('required', config.required);
                    if (config.required) {
                        labelElement.addClass('required-field');
                    } else {
                        labelElement.removeClass('required-field');
                    }
                } else {
                    parentContainer.hide();
                    labelElement.hide();
                    errorElement.hide();
                    inputElement.prop('required', false);
                    labelElement.removeClass('required-field');
                }
            });
            // Lógica específica para o campo numPessoas, que não tem um div pai direto
            const numPessoasLabel = $('#label-numPessoas');
            const numPessoasSelect = $('#numPessoas');
            const numPessoasError = $('#numPessoasError');
            const numPessoasConfig = currentFormConfig['numPessoas'] || { required: false, visible: true };
            if (numPessoasConfig.visible) {
                numPessoasLabel.show();
                numPessoasSelect.show();
                numPessoasSelect.prop('required', numPessoasConfig.required);
                if (numPessoasConfig.required) {
                    numPessoasLabel.addClass('required-field');
                } else {
                    numPessoasLabel.removeClass('required-field');
                }
            } else {
                numPessoasLabel.hide();
                numPessoasSelect.hide();
                numPessoasError.hide();
                numPessoasSelect.prop('required', false);
                numPessoasLabel.removeClass('required-field');
            }
        }

        // --- Lógica de Salvar Hospedagem (Cliente) ---
        $('#hospedagemForm').submit(function(e) {
            e.preventDefault();
            let valid = true;

            // Validações do formulário (mantidas do código original)
            const numPessoas = $('#numPessoas').val();
            if (currentFormConfig['numPessoas'] && currentFormConfig['numPessoas'].required && !numPessoas) { $('#numPessoasError').show(); valid = false; } else { $('#numPessoasError').hide(); }

            const nomeTitular = $('#nomeTitular').val().trim();
            if (currentFormConfig['nomeTitular'] && currentFormConfig['nomeTitular'].required && !nomeTitular) { $('#nomeTitularError').show(); valid = false; } else { $('#nomeTitularError').hide(); }

            const dataNascTitular = $('#dataNascTitular').val();
            if (currentFormConfig['dataNascTitular'] && currentFormConfig['dataNascTitular'].required && !validarDataNasc(dataNascTitular)) { $('#dataNascTitularError').show(); valid = false; } else { $('#dataNascTitularError').hide(); }

            const cpfTitular = $('#cpfTitular').val();
            if (currentFormConfig['cpfTitular'] && currentFormConfig['cpfTitular'].required && !validarCPF(cpfTitular)) { $('#cpfTitularError').show(); valid = false; } else if (cpfTitular && !validarCPF(cpfTitular)) { $('#cpfTitularError').show(); valid = false; } else { $('#cpfTitularError').hide(); }

            const celular = $('#celularTitular').val();
            if (currentFormConfig['celularTitular'] && currentFormConfig['celularTitular'].required && !validarCelular(celular)) { $('#celularTitularError').show(); valid = false; } else { $('#celularTitularError').hide(); }

            const email = $('#emailTitular').val();
            if (currentFormConfig['emailTitular'] && currentFormConfig['emailTitular'].required && !validarEmail(email)) { $('#emailTitularError').show(); valid = false; } else { $('#emailTitularError').hide(); }

            const cep = $('#cep').val();
            if (currentFormConfig['cep'] && currentFormConfig['cep'].required && (!cep || !validarCep(cep))) { $('#cepError').show(); valid = false; } else { $('#cepError').hide(); }

            const rua = $('#rua').val().trim();
            if (currentFormConfig['rua'] && currentFormConfig['rua'].required && !rua) { $('#ruaError').show(); valid = false; } else { $('#ruaError').hide(); }

            const bairro = $('#bairro').val().trim();
            if (currentFormConfig['bairro'] && currentFormConfig['bairro'].required && !bairro) { $('#bairroError').show(); valid = false; } else { $('#bairroError').hide(); }

            const cidade = $('#cidade').val().trim();
            if (currentFormConfig['cidade'] && currentFormConfig['cidade'].required && !cidade) { $('#cidadeError').show(); valid = false; } else { $('#cidadeError').hide(); }

            const numAcompanhantes = parseInt(numPessoas) - 1;
            const acompanhantesData = [];
            for (let i = 0; i < numAcompanhantes; i++) {
                const nomeAcomp = $(`#nomeAcomp_${i}`).val().trim();
                if (!nomeAcomp) { $(`#nomeAcomp_${i}Error`).show(); valid = false; } else { $(`#nomeAcomp_${i}Error`).hide(); }

                const dataNasc = $(`#dataNascAcomp_${i}`).val();
                if (!validarDataNasc(dataNasc)) { $(`#dataNascAcomp_${i}Error`).show(); valid = false; } else { $(`#dataNascAcomp_${i}Error`).hide(); }

                const idade = calcularIdade(dataNasc);
                const cpf = $(`#cpfAcomp_${i}`).val();
                // CPF obrigatório se idade >= cpfMinAge OU se preenchido e inválido
                if (idade >= cpfMinAge && (!cpf || !validarCPF(cpf))) { $(`#cpfAcomp_${i}Error`).show(); valid = false; }
                else if (cpf && !validarCPF(cpf)) { $(`#cpfAcomp_${i}Error`).show(); valid = false; }
                else { $(`#cpfAcomp_${i}Error`).hide(); }
                
                acompanhantesData.push({
                    nome: nomeAcomp,
                    dataNasc: dataNasc,
                    cpf: cpf
                });
            }

            if (!valid) {
                alert('Por favor, corrija os erros no formulário antes de salvar.');
                return;
            }

            // Coletar todos os dados do formulário
            const formData = {
                action: 'saveRecord', // Ação para o Apps Script
                id: Date.now(),
                timestamp: new Date().toLocaleString(),
                numPessoas: numPessoas,
                titular: {
                    nome: nomeTitular,
                    dataNasc: dataNascTitular,
                    cpf: cpfTitular,
                    rg: $('#rgTitular').val(),
                    celular: celular,
                    email: email,
                    placaCarro: $('#placaCarro').val()
                },
                endereco: {
                    cep: cep,
                    numero: $('#numero').val(),
                    rua: rua,
                    bairro: bairro,
                    cidade: cidade
                },
                acompanhantes: acompanhantesData
            };

            // Enviar para o Google Apps Script
            $.ajax({
                url: GOOGLE_APPS_SCRIPT_URL,
                method: 'POST',
                dataType: 'json',
                data: JSON.stringify(formData),
                contentType: 'application/json; charset=utf-8',
                success: function(response) {
                    if (response.status === 'success') {
                        alert('Formulário de hospedagem salvo com sucesso!');
                        $('#hospedagemForm')[0].reset();
                        $('#acompanhantes').empty();
                        // Não precisa chamar updateFormFields aqui, pois as configs não mudaram
                    } else {
                        alert('Erro ao salvar dados: ' + response.message);
                    }
                },
                error: function(xhr, status, error) {
                    alert('Erro na requisição: ' + error + '\nDetalhes: ' + xhr.responseText);
                }
            });
        });
    });

    

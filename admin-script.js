    const { jsPDF } = window.jspdf;

    let registrosHospedagem = [];
    const ADMIN_PASSWORD = "admin123"; // Senha de acesso ao painel administrativo (ainda no frontend, cuidado!)

    const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz7RrNBg1sTW5M4U5t-bYQk1djVdu7ZIdQI4iSwpIID0PVG719O0WfiFhNtFJ5ym4Vb3A/exec'; // URL ÚNICO para todas as operações

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
        // Autenticação para acessar a página admin
        const enteredPassword = prompt("ACESSO RESTRITO\n\nPor favor, insira a senha de administrador:");
        if (enteredPassword !== ADMIN_PASSWORD) {
            alert("⚠️ ACESSO NEGADO\n\nA senha inserida está incorreta.");
            window.location.href = 'index.html'; // Redireciona de volta para a página de cadastro
            return;
        }

        loadFormConfig(); // Carregar configurações para a tabela do admin
        renderFormConfigTable(); // Renderizar tabela de configurações
        loadAndRenderRegistros(); // Carregar e renderizar registros do Google Sheets

        // Função para desenhar tabela no PDF (mantida)
        function drawTable(doc, headers, data, x, y, colWidths, rowHeight = 8) {
            const padding = 2;
            doc.setFontSize(9);

            doc.setFillColor(200, 200, 200);
            doc.setFont("helvetica", "bold");
            headers.forEach((header, i) => {
                doc.rect(x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, colWidths[i], rowHeight, 'F');
                doc.text(header, x + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + padding, y + rowHeight - padding);
            });
            y += rowHeight;

            doc.setFont("helvetica", "normal");
            data.forEach(row => {
                row.forEach((cell, i) => {
                    doc.rect(x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, colWidths[i], rowHeight);
                    const textLines = doc.splitTextToSize(cell.toString(), colWidths[i] - 2 * padding);
                    doc.text(textLines[0], x + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + padding, y + rowHeight - padding);
                });
                y += rowHeight;
            });
            return y;
        }

        // --- Lógica de Configurações do Formulário ---
        async function loadFormConfig() {
            try {
                const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getFormConfig`);
                const data = await response.json();

                if (data.status === 'success' && data.config) {
                    currentFormConfig = data.config.fieldConfig || {};
                    cpfMinAge = data.config.cpfMinAge || 9; // Carrega a idade configurada
                    $('#cpfMinAge').val(cpfMinAge); // Atualiza o campo no admin
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
                    $('#cpfMinAge').val(cpfMinAge);
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
                $('#cpfMinAge').val(cpfMinAge);
            }
            renderFormConfigTable(); // Renderiza a tabela com as configurações carregadas
        }

        function renderFormConfigTable() {
            const tableBody = $('#form-config-table-body');
            tableBody.empty();
            formFields.forEach(field => {
                const config = currentFormConfig[field.id] || { required: false, visible: true }; // Padrão se não houver config
                const row = `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${field.label}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <label class="switch">
                                <input type="checkbox" id="req-${field.id}" ${config.required ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <label class="switch">
                                <input type="checkbox" id="vis-${field.id}" ${config.visible ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </td>
                    </tr>
                `;
                tableBody.append(row);
            });
        }

        $('#save-config').click(async function() {
            const newFieldConfig = {};
            formFields.forEach(field => {
                newFieldConfig[field.id] = {
                    required: $(`#req-${field.id}`).prop('checked'),
                    visible: $(`#vis-${field.id}`).prop('checked')
                };
            });
            const newCpfMinAge = parseInt($('#cpfMinAge').val());

            const configToSave = {
                action: 'saveFormConfig', // Ação para o Apps Script
                fieldConfig: newFieldConfig,
                cpfMinAge: newCpfMinAge
            };

            try {
                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    body: JSON.stringify(configToSave)
                });
                const data = await response.json();

                if (data.status === 'success') {
                    alert('Configurações salvas com sucesso! Elas serão aplicadas na página de cadastro.');
                    loadFormConfig(); // Recarrega as configurações para atualizar a interface do admin
                } else {
                    alert('Erro ao salvar configurações: ' + data.message);
                }
            } catch (error) {
                alert('Erro na requisição para salvar configurações: ' + error);
                console.error('Erro ao salvar configurações:', error);
            }
        });

        // --- Lógica de Registros de Hospedagem (Interação com Google Sheets) ---

        async function loadAndRenderRegistros() {
            try {
                const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getRecords`);
                const data = await response.json();

                if (data.status === 'success') {
                    registrosHospedagem = data.records.map(record => {
                        // Converte a string JSON de acompanhantes de volta para objeto
                        if (record.Acompanhantes) {
                            try {
                                record.Acompanhantes = JSON.parse(record.Acompanhantes);
                            } catch (e) {
                                console.error("Erro ao parsear acompanhantes:", e);
                                record.Acompanhantes = [];
                            }
                        } else {
                            record.Acompanhantes = [];
                        }
                        // Mapeia os nomes das colunas da planilha para os nomes do seu objeto JS
                        return {
                            id: record.ID,
                            timestamp: record.Timestamp,
                            numPessoas: record.NumPessoas,
                            titular: {
                                nome: record.NomeTitular,
                                dataNasc: record.DataNascTitular,
                                cpf: record.CPFTitular,
                                rg: record.RGTitular,
                                celular: record.CelularTitular,
                                email: record.EmailTitular,
                                placaCarro: record.PlacaCarro
                            },
                            endereco: {
                                cep: record.CEP,
                                numero: record.NumeroEndereco,
                                rua: record.Rua,
                                bairro: record.Bairro,
                                cidade: record.Cidade
                            },
                            acompanhantes: record.Acompanhantes
                        };
                    });
                    renderRegistrosList();
                } else {
                    alert('Erro ao carregar registros: ' + data.message);
                }
            } catch (error) {
                alert('Erro na requisição para carregar registros: ' + error);
                console.error('Erro ao carregar registros:', error);
            }
        }

        function renderRegistrosList() {
            const registrosListBody = $('#registros-list');
            registrosListBody.empty();
            const searchTerm = $('#search-registros').val().toLowerCase();

            const filteredAndSortedRegistros = registrosHospedagem
                .filter(registro => {
                    if (registro.titular.nome.toLowerCase().includes(searchTerm)) return true;
                    if (registro.titular.cpf && registro.titular.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))) return true;
                    if (registro.acompanhantes && registro.acompanhantes.some(acomp =>
                        acomp.cpf && acomp.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
                    )) return true;
                    if (registro.timestamp.toLowerCase().includes(searchTerm)) return true;
                    return false;
                })
                .sort((a, b) => b.id - a.id);

            filteredAndSortedRegistros.forEach(registro => {
                const row = `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" class="registro-checkbox rounded text-red-600" data-id="${registro.id}">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${registro.titular.nome}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${registro.titular.cpf || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${registro.numPessoas}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${registro.timestamp}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button class="view-registro bg-orange-500 hover:bg-orange-600 text-white font-bold py-1 px-2 rounded text-xs mr-1" data-id="${registro.id}">Ver</button>
                            <button class="delete-registro bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs" data-id="${registro.id}">Excluir</button>
                        </td>
                    </tr>
                `;
                registrosListBody.append(row);
            });

            $('.view-registro').off('click').on('click', function() {
                const id = $(this).data('id');
                viewRegistro(id);
            });
            $('.delete-registro').off('click').on('click', function() {
                const id = $(this).data('id');
                deleteRegistro(id);
            });

            $('#select-all-registros').off('change').on('change', function() {
                $('.registro-checkbox').prop('checked', $(this).prop('checked'));
            });
        }

        $('#search-registros').on('input', function() {
            renderRegistrosList();
        });

        function viewRegistro(id) {
            const registro = registrosHospedagem.find(r => r.id === id);
            if (registro) {
                let details = `
                    Detalhes do Registro de Hospedagem:\n
                    ID: ${registro.id}
                    Data/Hora do Registro: ${registro.timestamp}
                    Número de Pessoas: ${registro.numPessoas}\n
                    --- Dados do Titular ---\n
                    Nome: ${registro.titular.nome}
                    Data Nasc.: ${registro.titular.dataNasc}
                    CPF: ${registro.titular.cpf || 'Não informado'}
                    RG: ${registro.titular.rg || 'Não informado'}
                    Celular: ${registro.titular.celular}
                    Email: ${registro.titular.email}
                    Placa Carro: ${registro.titular.placaCarro || 'Não informado'}\n
                    --- Endereço ---\n
                    CEP: ${registro.endereco.cep}
                    Rua: ${registro.endereco.rua}, ${registro.endereco.numero || 'S/N'}
                    Bairro: ${registro.endereco.bairro}
                    Cidade: ${registro.endereco.cidade}\n
                `;
                if (registro.acompanhantes && registro.acompanhantes.length > 0) {
                    details += '--- Acompanhantes ---\n';
                    registro.acompanhantes.forEach((acomp, index) => {
                        details += `Acompanhante ${index + 1}:\n`;
                        details += `  Nome: ${acomp.nome}\n`;
                        details += `  Data Nasc.: ${acomp.dataNasc}\n`;
                        details += `  CPF: ${acomp.cpf || 'Não informado'}\n`;
                    });
                }
                alert(details);
            }
        }

        async function deleteRegistro(id) {
            if (confirm('Tem certeza que deseja excluir este registro?')) {
                try {
                    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        body: JSON.stringify({ action: 'deleteRecord', id: id }) // Envia a ação e o ID
                    });
                    const data = await response.json();

                    if (data.status === 'success') {
                        alert('Registro excluído com sucesso!');
                        loadAndRenderRegistros(); // Recarrega a lista após a exclusão
                    } else {
                        alert('Erro ao excluir registro: ' + data.message);
                    }
                } catch (error) {
                    alert('Erro na requisição de exclusão: ' + error);
                    console.error('Erro ao excluir registro:', error);
                }
            }
        }

        $('#generate-selected-pdf').click(function() {
            const selectedIds = $('.registro-checkbox:checked').map(function() {
                return parseInt($(this).data('id'));
            }).get();

            if (selectedIds.length === 0) {
                alert('Por favor, selecione pelo menos um registro para gerar o PDF.');
                return;
            }

            const selectedRegistros = registrosHospedagem.filter(r => selectedIds.includes(r.id));
            generateConsolidatedPDF(selectedRegistros);
        });

        function generateConsolidatedPDF(registros) {
            const doc = new jsPDF();
            let y = 10;

            doc.setFontSize(16);
            doc.text("Relatório de Registros de Hospedagem", 10, y);
            y += 10;
            doc.setFontSize(10);
            doc.text(`Gerado em: ${new Date().toLocaleString()}`, 10, y);
            y += 15;

            registros.forEach((registro, index) => {
                if (y > 280) {
                    doc.addPage();
                    y = 10;
                }

                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(`Registro #${index + 1} - Titular: ${registro.titular.nome}`, 10, y);
                y += 7;
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Data do Registro: ${registro.timestamp}`, 10, y);
                y += 5;
                doc.text(`Pessoas no Quarto: ${registro.numPessoas}`, 10, y);
                y += 10;

                doc.setFont("helvetica", "bold");
                doc.text("Dados do Titular:", 10, y);
                y += 5;
                const titularData = [
                    ["Nome", registro.titular.nome],
                    ["Nascimento", registro.titular.dataNasc],
                    ["CPF", registro.titular.cpf || 'N/A'],
                    ["RG", registro.titular.rg || 'N/A'],
                    ["Celular", registro.titular.celular],
                    ["Email", registro.titular.email],
                    ["Placa Carro", registro.titular.placaCarro || 'N/A']
                ];
                y = drawTable(doc, ["Campo", "Informação"], titularData, 10, y, [40, 150]);
                y += 5;

                doc.setFont("helvetica", "bold");
                doc.text("Endereço:", 10, y);
                y += 5;
                const enderecoData = [
                    ["CEP", registro.endereco.cep],
                    ["Rua", `${registro.endereco.rua}, ${registro.endereco.numero || 'S/N'}`],
                    ["Bairro", registro.endereco.bairro],
                    ["Cidade", registro.endereco.cidade]
                ];
                y = drawTable(doc, ["Campo", "Informação"], enderecoData, 10, y, [40, 150]);
                y += 5;

                if (registro.acompanhantes && registro.acompanhantes.length > 0) {
                    doc.setFont("helvetica", "bold");
                    doc.text("Acompanhantes:", 10, y);
                    y += 5;
                    const acompanhantesTableData = registro.acompanhantes.map(acomp => [
                        acomp.nome,
                        acomp.dataNasc,
                        acomp.cpf || 'N/A'
                    ]);
                    y = drawTable(doc, ["Nome", "Nascimento", "CPF"], acompanhantesTableData, 10, y, [80, 40, 70]);
                    y += 5;
                }
                y += 10;
            });

            doc.save('registros_hospedagem_consolidados.pdf');
        }
    });

    
